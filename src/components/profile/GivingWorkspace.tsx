import React, { useMemo, useState } from 'react';
import { Check, Copy, HeartHandshake, Landmark, Plus, Wallet, X } from 'lucide-react';
import { logAuditTrail, recordGivingEntry } from '../../services/fellowshipService';
import {
  GIVING_CATEGORIES,
  PAYMENT_METHODS,
  canManageFellowship,
  formatActionErrorMessage,
  formatGivingDate,
  formatNGNDecimal,
  generateGivingReference,
  getDisplayNameForAccount,
  getGivingCategoryLabel,
  getPaymentMethodLabel,
  sumCompletedGiving,
} from '../../utils/fellowshipLogic';
import type {
  FellowshipAccount,
  GivingCategoryKey,
  GivingRecord,
  PaymentMethodKey,
} from '../../types/fellowship';

interface GivingWorkspaceProps {
  account: FellowshipAccount;
  givingRecords: GivingRecord[];
  onToast: (message: string) => void;
}

export const GivingWorkspace: React.FC<GivingWorkspaceProps> = ({
  account,
  givingRecords,
  onToast,
}) => {
  const isLeadership = canManageFellowship(account.role);
  const displayName = getDisplayNameForAccount(account);

  const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine');
  const [copiedAcct, setCopiedAcct] = useState(false);

  // RecordGivingDialog state
  const [showDialog, setShowDialog] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<GivingCategoryKey>('TITHE');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>('BANK_TRANSFER');
  const [isFaithPledge, setIsFaithPledge] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userTotalGiving = useMemo(
    () => sumCompletedGiving(givingRecords, account.id),
    [givingRecords, account.id]
  );

  const fellowshipTotalGiving = useMemo(
    () => sumCompletedGiving(givingRecords),
    [givingRecords]
  );

  const visibleRecords = useMemo(() => {
    const sorted = [...givingRecords].sort((a, b) => b.createdAt - a.createdAt);
    if (isLeadership && viewMode === 'all') {
      return sorted;
    }
    return sorted.filter((g) => g.userId === account.id);
  }, [givingRecords, isLeadership, viewMode, account.id]);

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText('8135711999');
    } catch {
      // clipboard fallback
    }
    setCopiedAcct(true);
    onToast('Account number 8135711999 copied to clipboard');
    setTimeout(() => setCopiedAcct(false), 2000);
  };

  const handleSubmitGiving = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amountInput);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      onToast('Please enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      const refCode = generateGivingReference();
      const status = isFaithPledge ? 'PLEDGED' : 'COMPLETED';
      const cleanNotes = notes.trim();
      await recordGivingEntry({
        userId: account.id,
        donorName: displayName,
        userName: displayName,
        category,
        amountNgn: numericAmount,
        amount: numericAmount,
        paymentMethod,
        referenceCode: refCode,
        referenceNote: cleanNotes || `${getGivingCategoryLabel(category)} via ${getPaymentMethodLabel(paymentMethod)}`,
        purposeOrNotes: cleanNotes || undefined,
        status,
      });
      await logAuditTrail({
        actorName: displayName,
        actorRole: account.role,
        action: 'FINANCE_ENTRY_RECORDED',
        actionType: 'FINANCE_ENTRY_RECORDED',
        target: refCode,
        targetEntity: refCode,
        details: `${getGivingCategoryLabel(category)} • ${formatNGNDecimal(numericAmount)} (${status})`,
      });
      setAmountInput('');
      setNotes('');
      setIsFaithPledge(false);
      setShowDialog(false);
      onToast(`Financial entry recorded (Ref: ${refCode})`);
    } catch (err) {
      onToast(formatActionErrorMessage(err, 'Unable to record financial entry.'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeClasses = (status: GivingRecord['status']) => {
    const upper = String(status).toUpperCase();
    if (upper === 'COMPLETED' || upper === 'VERIFIED') {
      return 'bg-[#D1FAE5] text-[#065F46] dark:bg-[#10B981]/20 dark:text-[#34D399]';
    }
    if (upper === 'PLEDGED') {
      return 'bg-[#FEF3C7] text-[#92400E] dark:bg-[#F59E0B]/20 dark:text-[#FBBF24]';
    }
    return 'bg-[#F1F5F9] text-[#475569] dark:bg-[#334155] dark:text-[#CBD5E1]';
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Dark Hero Header Card (#0F172A with rounded-b-[24px]) */}
      <section className="rounded-t-2xl rounded-b-[24px] bg-[#0F172A] text-white border border-[#1E293B] p-5 sm:p-6 shadow-md space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#E11D48] flex items-center justify-center shrink-0 shadow-xs">
            <HeartHandshake className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-white">
              Financial Commitments &amp; Giving
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-0.5">
              Tithes, faith pledges, project dues &amp; donations
            </p>
          </div>
        </div>

        <div className={`grid ${isLeadership ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3`}>
          <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-4">
            <p className="text-xs font-semibold text-[#94A3B8]">Your Total Giving</p>
            <p className="font-mono text-2xl font-extrabold text-white mt-1 tabular-nums">
              {formatNGNDecimal(userTotalGiving)}
            </p>
          </div>

          {isLeadership && (
            <div className="rounded-2xl bg-[#1E293B] border border-[#F59E0B]/50 p-4">
              <p className="text-xs font-semibold text-[#FEF3C7]">
                The Gideonites - Youth Alive Total
              </p>
              <p className="font-mono text-2xl font-extrabold text-[#F59E0B] mt-1 tabular-nums">
                {formatNGNDecimal(fellowshipTotalGiving)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Official Bank Account Details Card */}
      <section className="rounded-2xl bg-white dark:bg-[#111827] border-2 border-[#F59E0B]/70 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] dark:bg-[#F59E0B]/20 flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B]" />
            </div>
            <h3 className="font-display text-sm sm:text-base font-bold text-[#0F172A] dark:text-white">
              Official Bank Account Details
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCopyAccount}
            className="min-h-[38px] px-3.5 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            {copiedAcct ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAcct ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-4 text-xs">
          <div>
            <dt className="text-[#64748B] dark:text-[#94A3B8]">Account Number</dt>
            <dd className="font-mono text-base font-extrabold text-[#E11D48] dark:text-[#FB7185] mt-0.5 tabular-nums">
              8135711999
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B] dark:text-[#94A3B8]">Bank Name</dt>
            <dd className="text-sm font-bold text-[#0F172A] dark:text-white mt-0.5">Opay</dd>
          </div>
          <div>
            <dt className="text-[#64748B] dark:text-[#94A3B8]">Account Name</dt>
            <dd className="text-sm font-bold text-[#0F172A] dark:text-white mt-0.5">
              Akande Peace Olubunmi
            </dd>
          </div>
        </dl>
      </section>

      {/* Leadership View Tabs */}
      {isLeadership && (
        <div
          role="tablist"
          aria-label="Giving history scope"
          className="grid grid-cols-2 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] rounded-2xl p-1.5 gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'mine'}
            onClick={() => setViewMode('mine')}
            className={`min-h-[42px] rounded-xl text-xs sm:text-sm font-bold ${
              viewMode === 'mine'
                ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                : 'text-[#64748B] dark:text-[#94A3B8]'
            }`}
          >
            My Giving History
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'all'}
            onClick={() => setViewMode('all')}
            className={`min-h-[42px] rounded-xl text-xs sm:text-sm font-bold ${
              viewMode === 'all'
                ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                : 'text-[#64748B] dark:text-[#94A3B8]'
            }`}
          >
            All Fellowship Records
          </button>
        </div>
      )}

      {/* Transaction History List */}
      <section className="space-y-3">
        {visibleRecords.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center space-y-2">
            <Wallet className="w-8 h-8 text-[#64748B] mx-auto" />
            <h4 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
              No Contributions Logged Yet
            </h4>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] max-w-sm mx-auto">
              Tap the + button below to record a tithe, offering, project donation, or faith pledge commitment.
            </p>
          </div>
        ) : (
          visibleRecords.map((item) => {
            const amountVal = Number(item.amount ?? item.amountNgn) || 0;
            const refLabel = item.referenceCode || item.id;
            const methodLabel = getPaymentMethodLabel(item.paymentMethod);
            const noteText = item.purposeOrNotes || item.referenceNote;
            return (
              <article
                key={item.id}
                className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">
                    {getGivingCategoryLabel(item.category)}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Ref: {refLabel} &bull; {methodLabel}
                  </p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {item.userName || item.donorName} &bull; {formatGivingDate(item.createdAt)}
                  </p>
                  {noteText && (
                    <p className="text-xs text-[#334155] dark:text-[#CBD5E1] pt-0.5 break-words">
                      {noteText}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0 space-y-1.5">
                  <p className="font-mono text-base font-extrabold text-[#E11D48] tabular-nums">
                    {formatNGNDecimal(amountVal)}
                  </p>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${getStatusBadgeClasses(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Bottom-Right #E11D48 Floating Action Button */}
      <button
        type="button"
        aria-label="Give / Pledge"
        onClick={() => setShowDialog(true)}
        className="fixed bottom-20 right-4 sm:right-6 z-30 h-14 px-5 rounded-2xl bg-[#E11D48] hover:bg-[#9F1239] text-white shadow-xl flex items-center gap-2 font-bold text-sm"
      >
        <Plus className="w-5 h-5" />
        <span>Give / Pledge</span>
      </button>

      {/* RecordGivingDialog Modal */}
      {showDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-giving-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <form
            onSubmit={handleSubmitGiving}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 id="record-giving-modal-title" className="font-display text-base font-bold">
                {isFaithPledge ? 'Record Faith Pledge' : 'Record Giving / Contribution'}
              </h3>
              <button
                type="button"
                aria-label="Close giving dialog"
                onClick={() => setShowDialog(false)}
                className="p-2 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label htmlFor="giving-amount" className="block text-xs font-semibold mb-1">
                Amount (NGN) *
              </label>
              <input
                id="giving-amount"
                type="number"
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm font-mono"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold mb-1.5">Category</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GIVING_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`min-h-[38px] px-2.5 rounded-xl text-xs font-bold border ${
                      category === cat.value
                        ? 'bg-[#E11D48] text-white border-[#E11D48]'
                        : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
                    }`}
                  >
                    {cat.displayName}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="giving-method" className="block text-xs font-semibold mb-1">
                Payment Method / Channel
              </label>
              <select
                id="giving-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodKey)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm font-medium"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.displayName}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2.5 rounded-xl bg-[#FEF3C7]/50 dark:bg-[#F59E0B]/10 border border-[#F59E0B]/40 p-3 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={isFaithPledge}
                onChange={(e) => setIsFaithPledge(e.target.checked)}
                className="w-4 h-4 accent-[#E11D48]"
              />
              <span>This is a future Faith Pledge commitment</span>
            </label>

            <div>
              <label htmlFor="giving-notes" className="block text-xs font-semibold mb-1">
                Purpose / Bank Transaction Reference
              </label>
              <input
                id="giving-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Opay Ref #49281 or Youth Week Seed"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 min-h-[44px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-sm font-bold disabled:opacity-60"
              >
                {submitting ? 'Saving...' : isFaithPledge ? 'Record Pledge' : 'Submit Record'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
