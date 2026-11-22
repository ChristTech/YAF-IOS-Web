import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATCH_UP_NOTIFICATION_CAP,
  appendCappedIds,
  evaluateDueProgrammeReminders,
  evaluatePushReadiness,
  getNotificationTargetTab,
  isNotificationForAccount,
  isNotificationReadByAccount,
  mergeAndFilterNotifications,
  selectCatchUpNotifications,
  syncRemoteNotificationIfNew,
  synthesizeNotificationFromFirestoreChange,
} from './notificationLogic';
import { DAY_MS } from './fellowshipLogic';
import type { FellowshipNotification, Programme } from '../types/fellowship';

test('isNotificationForAccount enforces recipientUserId and targetRole hierarchy', () => {
  const admin = { id: 'admin-1', role: 'ADMINISTRATOR' as const };
  const exec = { id: 'exec-1', role: 'YOUTH_EXECUTIVE' as const };
  const member = { id: 'mem-1', role: 'MEMBER' as const };

  const adminOnly: FellowshipNotification = {
    id: 'n1',
    fellowshipId: 'GIDEONITES',
    title: 'Flag',
    message: 'Check post',
    type: 'APPROVAL',
    targetRole: 'ADMINISTRATOR',
    createdAt: 100,
  };
  assert.equal(isNotificationForAccount(adminOnly, admin), true);
  assert.equal(isNotificationForAccount(adminOnly, exec), false);
  assert.equal(isNotificationForAccount(adminOnly, member), false);

  const execNotif: FellowshipNotification = {
    ...adminOnly,
    id: 'n2',
    targetRole: 'EXECUTIVE',
  };
  assert.equal(isNotificationForAccount(execNotif, admin), true);
  assert.equal(isNotificationForAccount(execNotif, exec), true);
  assert.equal(isNotificationForAccount(execNotif, member), false);

  const privateReply: FellowshipNotification = {
    ...adminOnly,
    id: 'n3',
    targetRole: 'ALL',
    recipientUserId: 'mem-1',
  };
  assert.equal(isNotificationForAccount(privateReply, member), true);
  assert.equal(isNotificationForAccount(privateReply, exec), false);
});

test('mergeAndFilterNotifications deduplicates, preserves read state, and sorts newest first', () => {
  const member = { id: 'mem-1', userId: 'mem-1', role: 'MEMBER' as const };
  const nOld: FellowshipNotification = {
    id: 'n-old',
    fellowshipId: 'GIDEONITES',
    title: 'Old Event',
    message: 'Join us',
    type: 'EVENT',
    targetRole: 'ALL',
    readByJson: '[]',
    createdAt: 100,
  };
  const nNew: FellowshipNotification = {
    id: 'n-new',
    fellowshipId: 'GIDEONITES',
    title: 'New Announcement',
    message: 'Today at 5pm',
    type: 'ANNOUNCEMENT',
    targetRole: 'ALL',
    readByJson: '["mem-1"]',
    createdAt: 300,
  };
  const nHiddenAdmin: FellowshipNotification = {
    id: 'n-admin',
    fellowshipId: 'GIDEONITES',
    title: 'Admin Approval',
    message: 'Pending exec',
    type: 'APPROVAL',
    targetRole: 'ADMINISTRATOR',
    createdAt: 500,
  };

  const merged = mergeAndFilterNotifications(
    [[nOld, nHiddenAdmin], [nNew, { ...nOld, readByJson: '[]' }]],
    member,
    ['n-old']
  );

  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'n-new');
  assert.equal(merged[1].id, 'n-old');
  assert.equal(isNotificationReadByAccount(merged[0], member, []), true);
  assert.equal(isNotificationReadByAccount(merged[1], member, ['n-old']), true);
});

test('evaluatePushReadiness detects iOS standalone requirement and active push state', () => {
  assert.equal(
    evaluatePushReadiness({
      hasNotificationApi: false,
      hasServiceWorker: true,
      hasPushManager: false,
      permission: 'unsupported',
      isIOS: true,
      isStandalone: false,
      hasActiveSubscription: false,
    }),
    'ios-install-required'
  );

  assert.equal(
    evaluatePushReadiness({
      hasNotificationApi: true,
      hasServiceWorker: true,
      hasPushManager: true,
      permission: 'granted',
      isIOS: true,
      isStandalone: true,
      hasActiveSubscription: true,
    }),
    'push-active'
  );

  assert.equal(
    evaluatePushReadiness({
      hasNotificationApi: true,
      hasServiceWorker: true,
      hasPushManager: true,
      permission: 'denied',
      isIOS: false,
      isStandalone: false,
      hasActiveSubscription: false,
    }),
    'permission-denied'
  );
});

test('synthesizeNotificationFromFirestoreChange maps programmes, inquiries, and skips verse packs', () => {
  const progEvent = synthesizeNotificationFromFirestoreChange({
    collectionName: 'programmes',
    docId: 'prog_1',
    data: { fellowshipId: 'GIDEONITES', titleEn: 'Youth Revival', venue: 'Main Sanctuary' },
    changeType: 'added',
    nowMs: 1000,
  });
  assert.ok(progEvent);
  assert.equal(progEvent.targetTab, 'home');
  assert.equal(progEvent.dedupKey, 'prog:prog_1');

  const packEvent = synthesizeNotificationFromFirestoreChange({
    collectionName: 'daily_scriptures',
    docId: 'scripture_biblepack_kjv_0',
    data: {
      fellowshipId: 'GIDEONITES',
      prayerPromptEn: JSON.stringify({ category: 'BIBLE_VERSE_PACK' }),
    },
    changeType: 'added',
  });
  assert.equal(packEvent, null);

  const inqReply = synthesizeNotificationFromFirestoreChange({
    collectionName: 'executive_inquiries',
    docId: 'inq_9',
    data: {
      fellowshipId: 'GIDEONITES',
      topic: 'Prayer',
      senderId: 'user-77',
      responseMessage: 'We are praying with you!',
    },
    prevData: { responseMessage: '' },
    changeType: 'modified',
    nowMs: 2000,
  });
  assert.ok(inqReply);
  assert.equal(inqReply.recipientUserId, 'user-77');
  assert.equal(getNotificationTargetTab(inqReply.type), 'community');
});

test('mergeAndFilterNotifications collapses duplicate local & synthesized alerts via dedupKey', () => {
  const member = { id: 'mem-1', role: 'MEMBER' as const };
  const localItem: FellowshipNotification = {
    id: 'notif-111',
    dedupKey: 'prog:prog_1',
    fellowshipId: 'GIDEONITES',
    title: 'New Programme: Youth Revival',
    message: 'Venue: Main Sanctuary',
    type: 'EVENT',
    targetRole: 'ALL',
    readByJson: '[]',
    createdAt: 1000,
  };
  const synItem: FellowshipNotification = {
    id: 'syn-prog-prog_1',
    dedupKey: 'prog:prog_1',
    fellowshipId: 'GIDEONITES',
    title: 'New Programme: Youth Revival',
    message: 'Venue: Main Sanctuary',
    type: 'EVENT',
    targetRole: 'ALL',
    readByJson: '[]',
    createdAt: 1050,
  };

  const merged = mergeAndFilterNotifications(
    [[localItem], [synItem]],
    member,
    ['prog:prog_1']
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'notif-111');
  assert.equal(isNotificationReadByAccount(merged[0], member, ['prog:prog_1']), true);
});

test('syncRemoteNotificationIfNew, appendCappedIds, catch-up cap (15), and 5d/1d programme reminders', () => {
  const account = { id: 'mem-1', userId: 'mem-1', role: 'YOUTH_MEMBER' as const };
  const sampleNotif: FellowshipNotification = {
    id: 'notif-remote-1',
    dedupKey: 'prog:p1',
    fellowshipId: 'GIDEONITES',
    title: 'Youth Night',
    message: 'Tonight',
    type: 'EVENT',
    targetRole: 'ALL',
    senderDeviceId: 'dev-other',
    readByJson: '[]',
    createdAt: 1000,
  };

  assert.equal(
    syncRemoteNotificationIfNew({
      notification: sampleNotif,
      account,
      activeUserId: null,
    }).reason,
    'no-active-user'
  );
  assert.equal(
    syncRemoteNotificationIfNew({
      notification: { ...sampleNotif, senderDeviceId: 'dev-me' },
      account,
      activeUserId: 'mem-1',
      deviceInstanceId: 'dev-me',
    }).reason,
    'local-device-origin'
  );
  assert.equal(
    syncRemoteNotificationIfNew({
      notification: sampleNotif,
      account,
      activeUserId: 'mem-1',
      deviceInstanceId: 'dev-me',
      locallyOriginatingIds: ['prog:p1'],
    }).reason,
    'locally-originating-id'
  );
  assert.equal(
    syncRemoteNotificationIfNew({
      notification: sampleNotif,
      account,
      activeUserId: 'mem-1',
      deviceInstanceId: 'dev-me',
      deliveredIds: ['notif-remote-1'],
    }).reason,
    'already-delivered'
  );
  assert.equal(
    syncRemoteNotificationIfNew({
      notification: sampleNotif,
      account,
      activeUserId: 'mem-1',
      deviceInstanceId: 'dev-me',
    }).shouldDeliver,
    true
  );

  // appendCappedIds caps to 300
  const large = Array.from({ length: 305 }, (_, i) => `id-${i}`);
  const capped = appendCappedIds([], large, 300);
  assert.equal(capped.length, 300);
  assert.equal(capped[0], 'id-5');

  // Catch-up cap = 15
  const twenty = Array.from({ length: 20 }, (_, i) => ({
    ...sampleNotif,
    id: `n-${i}`,
    dedupKey: `d-${i}`,
    createdAt: 1000 + i,
  }));
  const catchUp = selectCatchUpNotifications({
    notifications: twenty,
    account,
    activeUserId: 'mem-1',
    deviceInstanceId: 'dev-me',
  });
  assert.equal(catchUp.length, CATCH_UP_NOTIFICATION_CAP);
  assert.equal(catchUp[0].id, 'n-19');

  // 5-day and 1-day registered programme reminders
  const now = new Date(2026, 10, 20, 10, 0, 0, 0).getTime();
  const progs: Programme[] = [
    {
      id: 'prog_5d',
      fellowshipId: 'GIDEONITES',
      titleEn: 'Youth Revival',
      category: 'YOUTH_SERVICE',
      venue: 'Sanctuary',
      participantLimit: 100,
      startDateMillis: now + 4 * DAY_MS,
      registrationsJson: JSON.stringify([{ userId: 'mem-1', registeredAt: now - DAY_MS }]),
      createdAt: now - DAY_MS,
    },
    {
      id: 'prog_1d',
      fellowshipId: 'GIDEONITES',
      titleEn: 'Prayer Vigil',
      category: 'PRAYER_MEETING',
      venue: 'Altar',
      participantLimit: 100,
      startDateMillis: now + 12 * 60 * 60 * 1000,
      registrationsJson: JSON.stringify([{ userId: 'mem-1', registeredAt: now - DAY_MS }]),
      createdAt: now - DAY_MS,
    },
  ];
  const reminders = evaluateDueProgrammeReminders({ programmes: progs, account, nowMs: now });
  assert.equal(reminders.length, 2);
  assert.equal(reminders[0].id, 'notif_prog5d_prog_5d');
  assert.equal(reminders[1].id, 'notif_prog1d_prog_1d');
});

test('synthesizeNotificationFromFirestoreChange formats audio sermon alerts and suppresses expired programmes & COMPLETED quizzes', () => {
  const now = new Date(2026, 10, 20, 12, 0, 0, 0).getTime();

  const expiredProg = synthesizeNotificationFromFirestoreChange({
    collectionName: 'programmes',
    docId: 'prog_old',
    data: {
      fellowshipId: 'GIDEONITES',
      titleEn: 'Yesterday Event',
      venue: 'Hall',
      startDateMillis: now - 2 * DAY_MS,
    },
    changeType: 'added',
    nowMs: now,
  });
  assert.equal(expiredProg, null);

  const completedQuiz = synthesizeNotificationFromFirestoreChange({
    collectionName: 'quiz_sessions',
    docId: 'quiz_done',
    data: {
      fellowshipId: 'GIDEONITES',
      titleEn: 'Old Game',
      status: 'COMPLETED',
    },
    changeType: 'added',
    nowMs: now,
  });
  assert.equal(completedQuiz, null);

  const audioSermon = synthesizeNotificationFromFirestoreChange({
    collectionName: 'daily_scriptures',
    docId: 'res_123',
    data: {
      fellowshipId: 'GIDEONITES',
      prayerPromptEn: JSON.stringify({
        category: 'SERMON',
        title: 'Power of Faith',
        audioCloudId: 'sa_1234567890abcdef',
      }),
      verseTextEn: 'Power of Faith',
    },
    changeType: 'added',
    nowMs: now,
  });
  assert.ok(audioSermon);
  assert.equal(audioSermon.id, 'notif_res_res_123');
  assert.equal(audioSermon.title, '🎧 New Audio Sermon: Power of Faith');
});

