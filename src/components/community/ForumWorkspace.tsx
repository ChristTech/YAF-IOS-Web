import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Camera,
  CheckCircle2,
  Flag,
  Heart,
  MessageCircle,
  Pencil,
  PhoneCall,
  Pin,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { UserAvatar } from '../ChurchLogoBadge';
import {
  addCommentToPost,
  approveUnflagCommunityPost,
  createCommunityPost,
  deleteCommunityPost,
  flagCommunityPost,
  getLocalLikedPostIds,
  toggleLikePost,
  togglePinPost,
  updateCommunityPost,
} from '../../services/fellowshipService';
import {
  buildWhatsAppChatUrl,
  filterAndSortForumPosts,
  formatActionErrorMessage,
  formatShortDateTime,
  formatTimeOnly,
  getDisplayNameForAccount,
  getPostCommentsCount,
  getPostContact,
  getPostExpiryDaysRemaining,
  getPostPhoto,
  getRoleLabel,
  isTuesdayDate,
  isWorkSkillsCategory,
  normalizeForumCategory,
  parseJsonArray,
} from '../../utils/fellowshipLogic';
import { compressImageFileToDataUrl } from '../../utils/imageCompress';
import type { CommunityPost, FellowshipAccount, PostComment } from '../../types/fellowship';

interface ForumWorkspaceProps {
  account: FellowshipAccount;
  posts: CommunityPost[];
  isLeadership: boolean;
  onError: (msg: string | null) => void;
}

const POST_CATEGORIES = ['Discussion', 'Work/Skills', 'Testimonies', 'Prayer Requests', 'Q&A'] as const;

export const ForumWorkspace: React.FC<ForumWorkspaceProps> = ({
  account,
  posts,
  isLeadership,
  onError,
}) => {
  const currentUserId = account.userId || account.id;
  const nowMs = Date.now();
  const isTuesday = isTuesdayDate(nowMs);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterChip, setFilterChip] = useState<string>('All');
  const [, setLikeVersion] = useState(0);

  // Post Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editorCat, setEditorCat] = useState<string>('Discussion');
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorWhatsapp, setEditorWhatsapp] = useState('');
  const [editorPhoto, setEditorPhoto] = useState('');
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Comments Sheet Modal
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deleteTargetPost, setDeleteTargetPost] = useState<CommunityPost | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);

  const localLikedIds = getLocalLikedPostIds(currentUserId);

  const activeAllPosts = useMemo(
    () =>
      filterAndSortForumPosts(posts, {
        nowMs,
        filterChip: 'All',
        searchQuery: '',
        isLeadership,
      }),
    [posts, nowMs, isLeadership]
  );

  const flaggedCount = useMemo(
    () => activeAllPosts.filter((p) => p.isFlagged === true).length,
    [activeAllPosts]
  );

  const filteredPosts = useMemo(
    () =>
      filterAndSortForumPosts(posts, {
        nowMs,
        filterChip,
        searchQuery,
        isLeadership,
      }),
    [posts, nowMs, filterChip, searchQuery, isLeadership]
  );

  const filterChips = useMemo(() => {
    const list = ['All', 'Pinned'];
    if (isLeadership) {
      list.push('Flagged');
    }
    list.push('Discussion', 'Work/Skills', 'Testimonies', 'Prayer Requests', 'Q&A');
    return list;
  }, [isLeadership]);

  const commentsPost = useMemo(
    () => posts.find((p) => p.id === commentsPostId) || null,
    [posts, commentsPostId]
  );

  const commentsList = useMemo(() => {
    if (!commentsPost) return [];
    const arr = parseJsonArray<PostComment>(commentsPost.commentsJson, []);
    return [...arr].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [commentsPost]);

  const openCreateModal = () => {
    setEditingPost(null);
    setEditorCat(filterChip === 'Work/Skills' && isTuesday ? 'Work/Skills' : 'Discussion');
    setEditorTitle('');
    setEditorContent('');
    setEditorWhatsapp('');
    setEditorPhoto('');
    setEditorError(null);
    setEditorOpen(true);
  };

  const openEditModal = (post: CommunityPost) => {
    setEditingPost(post);
    setEditorCat(normalizeForumCategory(post.category));
    setEditorTitle(post.title || '');
    setEditorContent(post.content || '');
    setEditorWhatsapp(getPostContact(post));
    setEditorPhoto(getPostPhoto(post));
    setEditorError(null);
    setEditorOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;
    setEditorError(null);
    setCompressingPhoto(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 760, 255_000);
      setEditorPhoto(compressed);
    } catch (err) {
      setEditorPhoto('');
      setEditorError(formatActionErrorMessage(err, 'Could not optimize the selected image.'));
    } finally {
      setCompressingPhoto(false);
      inputEl.value = '';
    }
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (compressingPhoto) return;
    if (!editorContent.trim()) {
      setEditorError('Please share some details before publishing.');
      return;
    }

    setEditorError(null);
    setSavingPost(true);
    try {
      if (editingPost) {
        await updateCommunityPost(editingPost.id, {
          category: editorCat,
          title: editorTitle.trim(),
          content: editorContent.trim(),
          attachmentPhotoUri: editorPhoto || '',
          whatsappContact: editorWhatsapp.trim(),
        });
      } else {
        await createCommunityPost({
          author: account,
          category: editorCat,
          title: editorTitle.trim(),
          content: editorContent.trim(),
          attachmentPhotoUri: editorPhoto || undefined,
          whatsappContact: editorWhatsapp.trim() || undefined,
        });
      }
      setEditorOpen(false);
      setEditingPost(null);
    } catch (err) {
      setEditorError(formatActionErrorMessage(err, 'Unable to save forum post right now.'));
    } finally {
      setSavingPost(false);
    }
  };

  const handleToggleLike = async (post: CommunityPost) => {
    onError(null);
    try {
      await toggleLikePost(post, currentUserId);
      setLikeVersion((v) => v + 1);
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to update post reaction.'));
    }
  };

  const handlePinToggle = async (post: CommunityPost) => {
    onError(null);
    try {
      await togglePinPost(post);
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to update pin state.'));
    }
  };

  const handleFlagPost = async (post: CommunityPost) => {
    onError(null);
    try {
      await flagCommunityPost(post);
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to flag post for review.'));
    }
  };

  const handleApproveUnflag = async (post: CommunityPost) => {
    onError(null);
    try {
      await approveUnflagCommunityPost(post);
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to approve flagged post.'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetPost) return;
    setDeletingPost(true);
    onError(null);
    try {
      await deleteCommunityPost(deleteTargetPost.id, currentUserId);
      setDeleteTargetPost(null);
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to delete forum post.'));
    } finally {
      setDeletingPost(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentsPost || !replyText.trim()) return;
    setCommentsError(null);
    setSendingReply(true);
    try {
      await addCommentToPost(commentsPost, account, replyText.trim());
      setReplyText('');
    } catch (err) {
      setCommentsError(formatActionErrorMessage(err, 'Unable to post reply right now.'));
    } finally {
      setSendingReply(false);
    }
  };

  const isWorkSkillsSelected = isWorkSkillsCategory(editorCat);
  const canSelectWorkSkills =
    isTuesday || (editingPost ? isWorkSkillsCategory(editingPost.category) : false);

  const emptyStateCopy = useMemo(() => {
    if (filterChip === 'Flagged') {
      return {
        title: 'No Flagged Posts',
        subtitle: 'No community posts are currently flagged for leadership review.',
      };
    }
    if (filterChip === 'Work/Skills') {
      return {
        title: 'No Active Work/Skills Posts',
        subtitle: isTuesday
          ? 'Tuesday showcase is live! Be the first Gideonite to share your skill or business.'
          : 'Work/Skills listings expire after 3 days and open for posting every Tuesday.',
      };
    }
    return {
      title: 'No Discussions Found',
      subtitle: searchQuery.trim()
        ? 'No posts match your search query. Try another keyword.'
        : 'Encourage the fellowship by sharing a discussion topic, testimony, or prayer request.',
    };
  }, [filterChip, isTuesday, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-[#E11D48] absolute left-3.5 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search discussions, skills, topics, or authors..."
          aria-label="Search discussions, skills, topics, or authors"
          className="w-full min-h-[46px] pl-10 pr-10 rounded-[14px] bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] focus:border-[#E11D48] focus:outline-none text-sm text-[#0F172A] dark:text-white placeholder-[#64748B]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Horizontal Filter Chips */}
      <div
        role="tablist"
        aria-label="Forum category filters"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
      >
        {filterChips.map((chip) => {
          const isSelected = filterChip === chip;
          const isWorkChip = chip === 'Work/Skills';
          const isFlagChip = chip === 'Flagged';
          const chipLabel = isFlagChip
            ? `Flagged (${flaggedCount})`
            : isWorkChip && !isTuesday
            ? 'Work/Skills (Tuesdays)'
            : chip;

          return (
            <button
              key={chip}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setFilterChip(chip)}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors border ${
                isFlagChip && isSelected
                  ? 'bg-[#B91C1C] border-[#B91C1C] text-white'
                  : isSelected
                  ? 'bg-[#E11D48] border-[#E11D48] text-white'
                  : isWorkChip && !isTuesday
                  ? 'bg-[#F1F5F9] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151] text-[#64748B] dark:text-[#94A3B8]'
                  : 'bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1] hover:border-[#E11D48]/50'
              }`}
            >
              {isWorkChip && <Briefcase className="w-3.5 h-3.5" />}
              {isFlagChip && <Flag className="w-3.5 h-3.5" />}
              <span>{chipLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Tuesday Work/Skills Banner */}
      {filterChip === 'Work/Skills' && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs font-semibold flex items-center gap-2.5 ${
            isTuesday
              ? 'bg-[#DCFCE7] text-[#14532D] border border-[#16A34A]/30'
              : 'bg-[#F1F5F9] dark:bg-[#1F2937] text-[#475569] dark:text-[#CBD5E1] border border-[#E2E8F0] dark:border-[#374151]'
          }`}
        >
          <Briefcase className={`w-4 h-4 shrink-0 ${isTuesday ? 'text-[#16A34A]' : 'text-[#64748B]'}`} />
          <span>
            {isTuesday
              ? 'Tuesday Work/Skills Showcase is open! Share your business, job, or skill with your WhatsApp contact.'
              : 'Work/Skills posting opens every Tuesday.'}
          </span>
        </div>
      )}

      {/* Feed List or Empty State */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 text-[#E11D48] flex items-center justify-center mx-auto">
            {filterChip === 'Flagged' ? (
              <Flag className="w-6 h-6" />
            ) : filterChip === 'Work/Skills' ? (
              <Briefcase className="w-6 h-6" />
            ) : (
              <MessageCircle className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#0F172A] dark:text-white">{emptyStateCopy.title}</h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto">
              {emptyStateCopy.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[44px] px-5 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Start Conversation</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const normCat = normalizeForumCategory(post.category);
            const isWork = isWorkSkillsCategory(normCat);
            const contact = getPostContact(post);
            const photo = getPostPhoto(post);
            const commentsCount = getPostCommentsCount(post);
            const likedBy = parseJsonArray<string>(post.likedByJson, []);
            const hasLiked = localLikedIds.includes(post.id) || likedBy.includes(currentUserId);
            const isAuthor = post.authorId === currentUserId || post.authorId === account.id;
            const daysLeft = getPostExpiryDaysRemaining(post, nowMs);
            const whatsappHref = contact
              ? buildWhatsAppChatUrl(contact, post.title || post.content)
              : '';

            return (
              <article
                key={post.id}
                className={`rounded-2xl bg-white dark:bg-[#111827] overflow-hidden shadow-xs ${
                  post.isPinned
                    ? 'border-[1.5px] border-[#F59E0B]'
                    : 'border border-[#E2E8F0] dark:border-[#374151]'
                }`}
              >
                {/* Status Banners */}
                {post.isPinned && (
                  <div className="bg-[#FEF3C7] dark:bg-[#F59E0B]/15 px-4 py-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-[#B45309] dark:text-[#FBBF24]">
                    <Pin className="w-3.5 h-3.5" />
                    <span>PINNED BY LEADERSHIP</span>
                  </div>
                )}
                {post.isFlagged && (
                  <div className="bg-[#FEE2E2] dark:bg-[#9F1239]/25 px-4 py-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-[#B91C1C] dark:text-[#FCA5A5]">
                    <Flag className="w-3.5 h-3.5" />
                    <span>FLAGGED FOR REVIEW</span>
                  </div>
                )}

                <div className="p-4 sm:p-5 space-y-3">
                  {/* Author Header */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        account={{
                          id: post.authorId,
                          role: post.authorRole,
                          fullName: post.authorName,
                          avatarUrl: post.authorAvatarUri || post.authorAvatar,
                        }}
                        size={40}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0F172A] dark:text-white truncate">
                          {post.authorName}
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                          {getRoleLabel(post.authorRole)} • {formatShortDateTime(post.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          isWork
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : 'bg-[#FFF1F2] dark:bg-[#9F1239]/25 text-[#E11D48] dark:text-[#FB7185]'
                        }`}
                      >
                        {normCat}
                      </span>
                      {daysLeft !== null && (
                        <span className="text-[10px] font-semibold text-[#64748B]">
                          {daysLeft}d left
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  {post.title && (
                    <h4 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-white leading-snug">
                      {post.title}
                    </h4>
                  )}
                  <p className="text-sm text-[#334155] dark:text-[#E2E8F0] whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>

                  {photo && (
                    <img
                      src={photo}
                      alt={post.title || 'Forum attachment'}
                      referrerPolicy="no-referrer"
                      className="w-full h-[200px] object-cover rounded-xl border border-[#E2E8F0] dark:border-[#374151]"
                    />
                  )}

                  {/* WhatsApp Contact Card */}
                  {contact && (
                    <div className="rounded-xl bg-[#DCFCE7] dark:bg-[#064E3B]/40 border border-[#16A34A]/25 p-3.5 space-y-2.5">
                      <div>
                        <p className="text-[10px] font-extrabold tracking-wide text-[#166534] dark:text-[#6EE7B7]">
                          WORK / SKILLS CONTACT
                        </p>
                        <p className="text-xs font-bold text-[#14532D] dark:text-[#D1FAE5] mt-0.5 break-all">
                          WhatsApp: {contact}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {whatsappHref && (
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noreferrer"
                            className="min-h-[40px] px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Message on WhatsApp</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setCommentsPostId(post.id);
                            setCommentsError(null);
                          }}
                          className="min-h-[40px] px-3 rounded-xl bg-white/80 dark:bg-[#111827] border border-[#16A34A] text-[#14532D] dark:text-[#A7F3D0] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Comment</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#F1F5F9] dark:border-[#1F2937]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleLike(post)}
                        aria-label={`Like post (${post.likesCount || 0})`}
                        className={`min-h-[40px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                          hasLiked
                            ? 'bg-[#FFF1F2] dark:bg-[#9F1239]/30 text-[#E11D48]'
                            : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#64748B] dark:text-[#94A3B8]'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${hasLiked ? 'fill-[#E11D48]' : ''}`} />
                        <span className="tabular-nums">{post.likesCount || 0}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCommentsPostId(post.id);
                          setCommentsError(null);
                        }}
                        className="min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] text-xs font-bold text-[#334155] dark:text-[#CBD5E1] inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span className="tabular-nums">{commentsCount} replies</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {isAuthor && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(post)}
                            aria-label="Edit post"
                            title="Edit post"
                            className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937] text-[#64748B] dark:text-[#94A3B8] flex items-center justify-center"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetPost(post)}
                            aria-label="Delete post"
                            title="Delete post"
                            className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-[#FEE2E2] dark:hover:bg-[#9F1239]/25 text-[#B91C1C] flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {!post.isFlagged && !isAuthor && (
                        <button
                          type="button"
                          onClick={() => handleFlagPost(post)}
                          aria-label="Report or flag post"
                          title="Report for Leadership Review"
                          className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937] text-[#64748B] hover:text-[#B91C1C] flex items-center justify-center"
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                      )}

                      {post.isFlagged && isLeadership && (
                        <button
                          type="button"
                          onClick={() => handleApproveUnflag(post)}
                          aria-label="Approve and unflag post"
                          title="Approve & Unflag"
                          className="min-h-[40px] px-2.5 rounded-xl bg-[#DCFCE7] text-[#16A34A] text-xs font-bold inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Approve</span>
                        </button>
                      )}

                      {isLeadership && (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePinToggle(post)}
                            aria-label={post.isPinned ? 'Unpin post' : 'Pin post'}
                            title={post.isPinned ? 'Unpin post' : 'Pin post'}
                            className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center ${
                              post.isPinned
                                ? 'bg-[#FEF3C7] text-[#B45309]'
                                : 'hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937] text-[#64748B]'
                            }`}
                          >
                            <Pin className="w-4 h-4" />
                          </button>
                          {!isAuthor && (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetPost(post)}
                              aria-label="Moderate and delete post"
                              title="Delete post"
                              className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-[#FEE2E2] dark:hover:bg-[#9F1239]/25 text-[#B91C1C] flex items-center justify-center"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (+ New Post) */}
      <button
        type="button"
        onClick={openCreateModal}
        aria-label="Create new forum post"
        className="fixed bottom-24 right-4 sm:right-6 z-25 min-h-[52px] min-w-[52px] px-4 rounded-2xl bg-[#E11D48] hover:bg-[#9F1239] text-white shadow-xl flex items-center justify-center gap-2 font-bold text-sm transition-transform active:scale-95"
      >
        <Plus className="w-5 h-5" />
        <span className="hidden sm:inline">New Post</span>
      </button>

      {/* New / Edit Forum Post Modal */}
      {editorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-editor-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
        >
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden">
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between gap-2">
              <h2 id="post-editor-title" className="text-base font-bold">
                {editingPost ? 'Edit Forum Post' : 'New Forum Post'}
              </h2>
              <button
                type="button"
                aria-label="Close post editor"
                onClick={() => setEditorOpen(false)}
                className="p-2 rounded-lg text-[#94A3B8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePost} className="flex-1 overflow-y-auto p-5 space-y-4">
              {editorError && (
                <div
                  role="alert"
                  className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-3.5 py-2.5 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3] flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#E11D48]" />
                  <span>{editorError}</span>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-bold text-[#0F172A] dark:text-white">Category</p>
                <div className="flex flex-wrap gap-2">
                  {POST_CATEGORIES.map((cat) => {
                    const isWork = cat === 'Work/Skills';
                    const disabled = isWork && !canSelectWorkSkills;
                    const selected = editorCat === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        disabled={disabled}
                        onClick={() => setEditorCat(cat)}
                        className={`min-h-[38px] px-3 rounded-xl text-xs font-bold border transition-colors ${
                          disabled
                            ? 'bg-[#F1F5F9] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151] text-[#94A3B8] cursor-not-allowed opacity-70'
                            : selected
                            ? 'bg-[#E11D48] border-[#E11D48] text-white'
                            : 'bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
                        }`}
                      >
                        {disabled ? 'Work/Skills (Tuesdays Only)' : cat}
                      </button>
                    );
                  })}
                </div>
                {!canSelectWorkSkills && (
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Note: 'Work/Skills' is available on Tuesdays.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="post-title-input"
                  className="text-xs font-bold text-[#0F172A] dark:text-white"
                >
                  {isWorkSkillsSelected
                    ? 'Your Job / Skill / Business Title'
                    : 'Discussion Topic / Question'}
                </label>
                <input
                  id="post-title-input"
                  type="text"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  placeholder={
                    isWorkSkillsSelected
                      ? 'e.g., Full-Stack Web Developer & Graphics'
                      : 'e.g., Staying disciplined in campus fellowship'
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="post-content-input"
                  className="text-xs font-bold text-[#0F172A] dark:text-white"
                >
                  {isWorkSkillsSelected
                    ? 'Describe the work you do, services offered, & skills...'
                    : 'Share details, testimony, or scripture...'}
                </label>
                <textarea
                  id="post-content-input"
                  rows={4}
                  required
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder={
                    isWorkSkillsSelected
                      ? 'Describe your expertise, services offered, pricing, or collaboration needs...'
                      : 'Write clearly so fellow Gideonites can engage and pray with you...'
                  }
                  className="w-full p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
                />
              </div>

              {(isWorkSkillsSelected || editorWhatsapp.trim().length > 0) && (
                <div className="space-y-1">
                  <label
                    htmlFor="post-whatsapp-input"
                    className="text-xs font-bold text-[#15803D] dark:text-[#6EE7B7]"
                  >
                    WhatsApp Number or Link (e.g. +23480... or wa.me/...)
                  </label>
                  <input
                    id="post-whatsapp-input"
                    type="text"
                    value={editorWhatsapp}
                    onChange={(e) => setEditorWhatsapp(e.target.value)}
                    placeholder="+23480... or wa.me/..."
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#16A34A]/40 text-sm"
                  />
                </div>
              )}

              {/* Picture Attachment */}
              <div className="space-y-2">
                {editorPhoto && (
                  <div className="relative rounded-[10px] overflow-hidden border border-[#E2E8F0] dark:border-[#374151]">
                    <img
                      src={editorPhoto}
                      alt="Post attachment preview"
                      className="w-full h-[120px] object-cover"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <label className="min-h-[42px] px-3.5 rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                    <Camera className="w-4 h-4 text-[#E11D48]" />
                    <span>
                      {compressingPhoto
                        ? 'Optimizing Image...'
                        : editorPhoto
                        ? 'Change Picture'
                        : 'Attach Picture (Optional)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={compressingPhoto}
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {editorPhoto && (
                    <button
                      type="button"
                      onClick={() => setEditorPhoto('')}
                      className="min-h-[42px] px-3 rounded-xl bg-[#FEE2E2] text-[#B91C1C] text-xs font-bold"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0] dark:border-[#374151]">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold text-[#334155] dark:text-[#CBD5E1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPost || compressingPhoto}
                  className="min-h-[44px] px-5 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {savingPost
                      ? 'Saving...'
                      : editingPost
                      ? 'Update Post'
                      : 'Publish Post'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replies Modal (CommentsSheetDialog) */}
      {commentsPost && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="comments-dialog-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden">
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="comments-dialog-title" className="text-base font-bold">
                  Replies
                </h2>
                <p className="text-xs text-[#94A3B8] truncate">
                  {commentsPost.title || commentsPost.content}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close replies modal"
                onClick={() => setCommentsPostId(null)}
                className="p-2 rounded-lg text-[#94A3B8] hover:text-white shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {commentsError && (
                <div
                  role="alert"
                  className="rounded-xl bg-[#FFF1F2] text-[#9F1239] px-3 py-2 text-xs font-semibold"
                >
                  {commentsError}
                </div>
              )}

              {commentsList.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <MessageCircle className="w-8 h-8 text-[#64748B] mx-auto opacity-60" />
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] px-4">
                    Be the first to share your thoughts or message {commentsPost.authorName} here!
                  </p>
                </div>
              ) : (
                commentsList.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] p-3 flex items-start gap-2.5"
                  >
                    <UserAvatar
                      account={{
                        id: c.authorId,
                        role: c.authorRole,
                        fullName: c.authorName,
                        avatarUrl: c.authorAvatarUri,
                      }}
                      size={28}
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[#0F172A] dark:text-white truncate">
                          {c.authorName} ({getRoleLabel(c.authorRole)})
                        </span>
                        <span className="text-[11px] text-[#64748B] shrink-0">
                          {formatTimeOnly(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] whitespace-pre-wrap">
                        {c.content || c.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleSendReply}
              className="p-3 sm:p-4 border-t border-[#E2E8F0] dark:border-[#374151] bg-white dark:bg-[#111827] flex items-center gap-2 pb-safe"
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
              <button
                type="submit"
                disabled={sendingReply || !replyText.trim()}
                aria-label="Send reply"
                className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] disabled:opacity-50 text-white flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Forum Post Confirmation Dialog */}
      {deleteTargetPost && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-post-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-post-title" className="text-base font-bold text-[#0F172A] dark:text-white">
                  Delete Forum Post?
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
                  This post, all its replies, and likes will be permanently removed across all devices.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetPost(null)}
                className="min-h-[42px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold text-[#334155] dark:text-[#CBD5E1]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPost}
                onClick={handleConfirmDelete}
                className="min-h-[42px] px-4 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-bold"
              >
                {deletingPost ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
