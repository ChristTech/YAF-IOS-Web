import React, { useEffect, useState } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import { UserAvatar } from '../ChurchLogoBadge';
import { ALL_DEPARTMENT_TYPES } from '../../data/bibleData';
import { updateAccountProfile } from '../../services/fellowshipService';
import { compressAvatarImageFile } from '../../utils/documentParser';
import {
  formatActionErrorMessage,
  isAdministratorRole,
  normalizeDepartmentType,
} from '../../utils/fellowshipLogic';
import type { FellowshipAccount } from '../../types/fellowship';

interface EditProfileDialogProps {
  isOpen: boolean;
  account: FellowshipAccount;
  onClose: () => void;
  onSaved: (updated: FellowshipAccount) => void;
  onToast: (message: string) => void;
}

export const EditProfileDialog: React.FC<EditProfileDialogProps> = ({
  isOpen,
  account,
  onClose,
  onSaved,
  onToast,
}) => {
  const isAdmin = isAdministratorRole(account.role);
  const isLockedAdminName =
    account.id === 'user-admin-01' || account.email?.trim().toLowerCase() === 'admin@youthalive.org';

  const [fullName, setFullName] = useState(isAdmin ? 'Admin' : account.fullName);
  const [phone, setPhone] = useState(account.phone || account.phoneNumber || '');
  const [department, setDepartment] = useState<string>(
    normalizeDepartmentType(account.department)
  );
  const [address, setAddress] = useState(account.address || '');
  const [photoUri, setPhotoUri] = useState<string>(
    account.profilePhotoUri || account.avatarUrl || ''
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFullName(isAdmin ? 'Admin' : account.fullName);
      setPhone(account.phone || account.phoneNumber || '');
      setDepartment(normalizeDepartmentType(account.department));
      setAddress(account.address || '');
      setPhotoUri(account.profilePhotoUri || account.avatarUrl || '');
      setErrorMsg(null);
    }
  }, [isOpen, account, isAdmin]);

  if (!isOpen) return null;

  const handleSelectPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const compressed = await compressAvatarImageFile(file, 280, 88_000);
      setPhotoUri(compressed);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to process selected image.'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const nextName = isLockedAdminName || isAdmin ? 'Admin' : fullName.trim() || account.fullName;
    const nextDept = isAdmin ? account.department || 'GENERAL' : department;
    setSaving(true);
    try {
      await updateAccountProfile(account.id, {
        fullName: nextName,
        phone: phone.trim(),
        phoneNumber: phone.trim(),
        department: nextDept,
        address: address.trim(),
        profilePhotoUri: photoUri,
        avatarUrl: photoUri,
        userId: account.userId,
      });
      onSaved({
        ...account,
        fullName: nextName,
        phone: phone.trim(),
        phoneNumber: phone.trim(),
        department: nextDept,
        address: address.trim(),
        profilePhotoUri: photoUri,
        avatarUrl: photoUri,
        updatedAt: Date.now(),
      });
      onToast('Profile updated successfully.');
      onClose();
    } catch (err) {
      setErrorMsg(formatActionErrorMessage(err, 'Unable to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  const previewAccount = {
    id: account.id,
    role: account.role,
    fullName: fullName || account.fullName,
    avatarUrl: photoUri || undefined,
    profilePhotoUri: photoUri || undefined,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 id="edit-profile-modal-title" className="font-display text-base font-bold">
            {isAdmin ? 'Edit Administrator Account' : 'Edit Member Profile'}
          </h3>
          <button
            type="button"
            aria-label="Close edit profile modal"
            onClick={onClose}
            className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-3 py-2 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3]"
          >
            {errorMsg}
          </div>
        )}

        {/* 72px Avatar Editor Row */}
        <div className="flex items-center gap-4 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] p-3.5 border border-[#E2E8F0] dark:border-[#374151]">
          <UserAvatar account={previewAccount} size={72} />
          <div className="flex flex-wrap gap-2">
            <label className="min-h-[40px] px-3.5 rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <Camera className="w-3.5 h-3.5" />
              <span>
                {isAdmin
                  ? photoUri
                    ? 'Change Emblem'
                    : 'Attach Emblem'
                  : photoUri
                  ? 'Change Picture'
                  : 'Attach Picture'}
              </span>
              <input type="file" accept="image/*" onChange={handleSelectPhoto} className="hidden" />
            </label>
            {photoUri && (
              <button
                type="button"
                onClick={() => setPhotoUri('')}
                className="min-h-[40px] px-3 rounded-xl border border-[#E11D48]/50 text-[#E11D48] text-xs font-bold inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="edit-profile-name" className="block text-xs font-semibold mb-1">
            {isAdmin ? 'Administrator Title / Display Name' : 'Full Name'}
          </label>
          <input
            id="edit-profile-name"
            type="text"
            required
            disabled={isLockedAdminName || isAdmin}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm disabled:opacity-70"
          />
        </div>

        <div>
          <label htmlFor="edit-profile-phone" className="block text-xs font-semibold mb-1">
            {isAdmin ? 'Official Contact Line' : 'Phone Number'}
          </label>
          <input
            id="edit-profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+2348011223344"
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
          />
        </div>

        {!isAdmin && (
          <div>
            <label htmlFor="edit-profile-dept" className="block text-xs font-semibold mb-1">
              Department / Ministry Unit
            </label>
            <select
              id="edit-profile-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm font-medium"
            >
              {ALL_DEPARTMENT_TYPES.map((d) => (
                <option key={d.type} value={d.type}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="edit-profile-address" className="block text-xs font-semibold mb-1">
            {isAdmin ? 'Secretariat / Office Location' : 'Residential Address'}
          </label>
          <input
            id="edit-profile-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={
              isAdmin
                ? 'Living Faith Church Youth Alive Fellowship Secretariat'
                : 'Enter residential address'
            }
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
          />
        </div>

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-sm font-bold disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
