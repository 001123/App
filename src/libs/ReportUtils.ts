import {format} from 'date-fns';
import {SvgProps} from 'react-native-svg';
import Str from 'expensify-common/lib/str';
import lodashEscape from 'lodash/escape';
import lodashIsEqual from 'lodash/isEqual';
import lodashFindLastIndex from 'lodash/findLastIndex';
import lodashIntersection from 'lodash/intersection';

import {ValueOf} from 'type-fest';
import Onyx, {OnyxCollection, OnyxEntry, OnyxUpdate} from 'react-native-onyx';
import ExpensiMark from 'expensify-common/lib/ExpensiMark';
import ONYXKEYS from '../ONYXKEYS';
import CONST from '../CONST';
import * as Localize from './Localize';
import * as Expensicons from '../components/Icon/Expensicons';
import Navigation from './Navigation/Navigation';
import ROUTES from '../ROUTES';
import * as NumberUtils from './NumberUtils';
import * as ReportActionsUtils from './ReportActionsUtils';
import * as TransactionUtils from './TransactionUtils';
import * as Url from './Url';
import Permissions from './Permissions';
import DateUtils from './DateUtils';
import linkingConfig from './Navigation/linkingConfig';
import isReportMessageAttachment from './isReportMessageAttachment';
import * as defaultWorkspaceAvatars from '../components/Icon/WorkspaceDefaultAvatars';
import * as CurrencyUtils from './CurrencyUtils';
import * as UserUtils from './UserUtils';
import {Beta, Login, PersonalDetails, Policy, Report, ReportAction, Transaction} from '../types/onyx';
import {Receipt} from '../types/onyx/Transaction';
import DeepValueOf from '../types/utils/DeepValueOf';
import {Closed, IOUMessage} from '../types/onyx/OriginalMessage';
import {Message, ReportActions} from '../types/onyx/ReportAction';

type WelcomeMessage = {showReportName: boolean; phrase1?: string; phrase2?: string};

type Avatar = {
    id: number;
    source: React.FC<SvgProps> | string | undefined;
    type: typeof CONST.ICON_TYPE_AVATAR | typeof CONST.ICON_TYPE_WORKSPACE;
    name: string;
    fallbackIcon?: React.FC<SvgProps> | string;
};

type ExpanseOriginalMessage = {
    oldComment?: string;
    newComment?: string;
    comment?: string;
    merchant?: string;
    oldCreated?: string;
    created?: string;
    oldMerchant?: string;
    oldAmount?: number;
    amount?: number;
    oldCurrency?: string;
    currency?: string;
    category?: string;
    oldCategory?: string;
    tag?: string;
    oldTag?: string;
    billable?: string;
    oldBillable?: string;
};

type Participant = {
    accountID: number;
    alternateText: string;
    firstName: string;
    icons: Avatar[];
    keyForList: string;
    lastName: string;
    login: string;
    phoneNumber: string;
    searchText: string;
    selected: boolean;
    text: string;
};

function isTypeTransaction(arg: Transaction | Record<string, never>): arg is Transaction {
    return arg !== undefined; // Customize this type guard as needed
}

function isTypeReportAction(arg: ReportAction | Record<string, never>): arg is ReportAction {
    return arg !== undefined; // Customize this type guard as needed
}

let currentUserEmail: string | undefined;
let currentUserAccountID: number | undefined;
let isAnonymousUser = false;

Onyx.connect({
    key: ONYXKEYS.SESSION,
    callback: (value) => {
        // When signed out, val is undefined
        if (!value) {
            return;
        }

        currentUserEmail = value.email;
        currentUserAccountID = value.accountID;
        isAnonymousUser = value.authTokenType === 'anonymousAccount';
    },
});

let allPersonalDetails: OnyxCollection<PersonalDetails>;
let currentUserPersonalDetails: OnyxEntry<PersonalDetails | undefined>;
Onyx.connect({
    key: ONYXKEYS.PERSONAL_DETAILS_LIST,
    callback: (value) => {
        currentUserPersonalDetails = value?.[currentUserAccountID ?? ''];
        allPersonalDetails = value ?? {};
    },
});

let allReports: OnyxCollection<Report>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT,
    waitForCollectionCallback: true,
    callback: (val) => (allReports = val),
});

let doesDomainHaveApprovedAccountant = false;
Onyx.connect({
    key: ONYXKEYS.ACCOUNT,
    // waitForCollectionCallback: true,
    callback: (value) => (doesDomainHaveApprovedAccountant = value?.doesDomainHaveApprovedAccountant ?? false),
});

let allPolicies: OnyxCollection<Policy>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.POLICY,
    waitForCollectionCallback: true,
    callback: (val) => (allPolicies = val),
});

let loginList: OnyxEntry<Login>;
Onyx.connect({
    key: ONYXKEYS.LOGIN_LIST,
    callback: (val) => (loginList = val),
});

function getChatType(report?: OnyxEntry<Report>): ValueOf<typeof CONST.REPORT.CHAT_TYPE> | undefined {
    return report?.chatType;
}

function getPolicy(policyID: string): OnyxEntry<Policy> {
    if (!allPolicies || !policyID) {
        return null;
    }
    return allPolicies[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`];
}

/**
 * Get the policy type from a given report
 * @param  report
 * @param  policies must have Onyxkey prefix (i.e 'policy_') for keys
 */
function getPolicyType(report: OnyxEntry<Report>, policies: OnyxCollection<Policy>): string {
    return policies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.type ?? '';
}

/**
 * Get the policy name from a given report
 */
function getPolicyName(report?: OnyxEntry<Report>, returnEmptyIfNotFound = false, policy: OnyxEntry<Policy | undefined> = undefined): string {
    const noPolicyFound = returnEmptyIfNotFound ? '' : Localize.translateLocal('workspace.common.unavailable');
    if (Object.keys(report ?? {}).length === 0) {
        return noPolicyFound;
    }

    if ((!allPolicies || Object.keys(allPolicies).length === 0) && !report?.policyName) {
        return Localize.translateLocal('workspace.common.unavailable');
    }
    const finalPolicy = policy ?? allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];

    // Public rooms send back the policy name with the reportSummary,
    // since they can also be accessed by people who aren't in the workspace
    const policyName = finalPolicy?.name ?? report?.policyName ?? report?.oldPolicyName ?? noPolicyFound;

    return policyName;
}

/**
 * Returns the concatenated title for the PrimaryLogins of a report
 */
function getReportParticipantsTitle(accountIDs: number[]): string {
    return accountIDs.filter(Boolean).join(', ');
}

/**
 * Checks if a report is a chat report.
 */
function isChatReport(report: OnyxEntry<Report>): boolean {
    return report?.type === CONST.REPORT.TYPE.CHAT;
}

/**
 * Checks if a report is an Expense report.
 */
function isExpenseReport(report?: OnyxEntry<Report>): boolean {
    return report?.type === CONST.REPORT.TYPE.EXPENSE;
}

/**
 * Checks if a report is an IOU report.
 */
function isIOUReport(report?: OnyxEntry<Report>): boolean {
    return report?.type === CONST.REPORT.TYPE.IOU;
}

/**
 * Checks if a report is a task report.
 */
function isTaskReport(report: OnyxEntry<Report>): boolean {
    return report?.type === CONST.REPORT.TYPE.TASK;
}

/**
 * Checks if a task has been cancelled
 * When a task is deleted, the parentReportAction is updated to have a isDeletedParentAction deleted flag
 * This is because when you delete a task, we still allow you to chat on the report itself
 * There's another situation where you don't have access to the parentReportAction (because it was created in a chat you don't have access to)
 * In this case, we have added the key to the report itself
 */
function isCanceledTaskReport(report: OnyxEntry<Report>, parentReportAction?: OnyxEntry<ReportAction>): boolean {
    if (Object.keys(parentReportAction ?? {}).length > 0 && (parentReportAction?.message?.[0]?.isDeletedParentAction ?? false)) {
        return true;
    }

    if (Object.keys(report ?? {}).length > 0 && report?.isDeletedParentAction) {
        return true;
    }

    return false;
}

/**
 * Checks if a report is an open task report.
 *
 * @param report
 * @param parentReportAction - The parent report action of the report (Used to check if the task has been canceled)
 */
function isOpenTaskReport(report: OnyxEntry<Report>, parentReportAction?: OnyxEntry<ReportAction>): boolean {
    return isTaskReport(report) && !isCanceledTaskReport(report, parentReportAction) && report?.stateNum === CONST.REPORT.STATE_NUM.OPEN && report?.statusNum === CONST.REPORT.STATUS.OPEN;
}

/**
 * Checks if a report is a completed task report.
 */
function isCompletedTaskReport(report: OnyxEntry<Report>) {
    return isTaskReport(report) && report?.stateNum === CONST.REPORT.STATE_NUM.SUBMITTED && report?.statusNum === CONST.REPORT.STATUS.APPROVED;
}

/**
 * Checks if the current user is the manager of the supplied report
 */
function isReportManager(report: OnyxEntry<Report>): boolean {
    return report?.managerID === currentUserAccountID;
}

/**
 * Checks if the supplied report has been approved
 */
function isReportApproved(report: OnyxEntry<Report> | undefined): boolean {
    return report?.stateNum === CONST.REPORT.STATE_NUM.SUBMITTED && report.statusNum === CONST.REPORT.STATUS.APPROVED;
}

/**
 * Given a collection of reports returns them sorted by last read
 */
function sortReportsByLastRead(reports: OnyxCollection<Report>): Array<OnyxEntry<Report>> {
    return Object.values(reports ?? {})
        .filter((report) => report?.reportID && report?.lastReadTime)
        .sort((a, b) => {
            const aTime = a?.lastReadTime ? parseISO(a.lastReadTime) : 0;
            const bTime = b?.lastReadTime ? parseISO(b.lastReadTime) : 0;
            return Number(aTime) - Number(bTime);
        });
}

/**
 * Whether the Money Request report is settled
 */
function isSettled(reportID?: string): boolean {
    if (!allReports) {
        return false;
    }
    const report = allReports[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
    if ((typeof report === 'object' && Object.keys(report ?? {}).length === 0) || report?.isWaitingOnBankAccount) {
        return false;
    }

    return report?.statusNum === CONST.REPORT.STATUS.REIMBURSED;
}

/**
 * Whether the current user is the submitter of the report
 */
function isCurrentUserSubmitter(reportID: string): boolean {
    if (!allReports) {
        return false;
    }
    const report = allReports[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
    return report?.ownerEmail === currentUserEmail;
}

/**
 * Whether the provided report is an Admin room
 */
function isAdminRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_ADMINS;
}

/**
 * Whether the provided report is an Admin-only posting room
 */
function isAdminsOnlyPostingRoom(report: OnyxEntry<Report>): boolean {
    return (report?.writeCapability ?? CONST.REPORT.WRITE_CAPABILITIES.ALL) === CONST.REPORT.WRITE_CAPABILITIES.ADMINS;
}

/**
 * Whether the provided report is a Announce room
 */
function isAnnounceRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE;
}

/**
 * Whether the provided report is a default room
 */
function isDefaultRoom(report: OnyxEntry<Report>): boolean {
    return [CONST.REPORT.CHAT_TYPE.POLICY_ADMINS, CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE, CONST.REPORT.CHAT_TYPE.DOMAIN_ALL].some((type) => type === getChatType(report));
}

/**
 * Whether the provided report is a Domain room
 */
function isDomainRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.DOMAIN_ALL;
}

/**
 * Whether the provided report is a user created policy room
 */
function isUserCreatedPolicyRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_ROOM;
}

/**
 * Whether the provided report is a Policy Expense chat.
 */
function isPolicyExpenseChat(report?: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT;
}

/** Wether the provided report belongs to a Control policy and is an epxense chat
 */
function isControlPolicyExpenseChat(report: OnyxEntry<Report>): boolean {
    return isPolicyExpenseChat(report) && getPolicyType(report, allPolicies) === CONST.POLICY.TYPE.CORPORATE;
}

/** Wether the provided report belongs to a Control policy and is an epxense report
 */
function isControlPolicyExpenseReport(report: OnyxEntry<Report>): boolean {
    return isExpenseReport(report) && getPolicyType(report, allPolicies) === CONST.POLICY.TYPE.CORPORATE;
}

/**
 * Whether the provided report is a chat room
 */
function isChatRoom(report: OnyxEntry<Report>): boolean {
    return isUserCreatedPolicyRoom(report) || isDefaultRoom(report);
}

/**
 * Whether the provided report is a public room
 */
function isPublicRoom(report: OnyxEntry<Report>): boolean {
    return report?.visibility === CONST.REPORT.VISIBILITY.PUBLIC || report?.visibility === CONST.REPORT.VISIBILITY.PUBLIC_ANNOUNCE;
}

/**
 * Whether the provided report is a public announce room
 */
function isPublicAnnounceRoom(report: OnyxEntry<Report>): boolean {
    return report?.visibility === CONST.REPORT.VISIBILITY.PUBLIC_ANNOUNCE;
}

/**
 * If the report is a policy expense, the route should be for adding bank account for that policy
 * else since the report is a personal IOU, the route should be for personal bank account.
 */
function getBankAccountRoute(report: OnyxEntry<Report>): string {
    return isPolicyExpenseChat(report) ? ROUTES.BANK_ACCOUNT_WITH_STEP_TO_OPEN.getRoute('', report?.policyID) : ROUTES.SETTINGS_ADD_BANK_ACCOUNT;
}

/**
 * Check if personal detail of accountID is empty or optimistic data
 */
function isOptimisticPersonalDetail(accountID: number): boolean {
    return Object.keys(allPersonalDetails?.[accountID] ?? {}).length === 0 || !!allPersonalDetails?.[accountID]?.isOptimisticPersonalDetail;
}

/**
 * Checks if a report is a task report from a policy expense chat.
 */
function isWorkspaceTaskReport(report: OnyxEntry<Report>): boolean {
    if (!isTaskReport(report)) {
        return false;
    }
    const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`];
    return isPolicyExpenseChat(parentReport);
}

/**
 * Returns true if report has a parent
 */
function isThread(report: OnyxEntry<Report>): boolean {
    return Boolean(report?.parentReportID && report?.parentReportActionID);
}

/**
 * Returns true if report is of type chat and has a parent and is therefore a Thread.
 */
function isChatThread(report: OnyxEntry<Report>): boolean {
    return isThread(report) && report?.type === CONST.REPORT.TYPE.CHAT;
}

/**
 * Only returns true if this is our main 1:1 DM report with Concierge
 */
function isConciergeChatReport(report: OnyxEntry<Report>): boolean {
    return report?.participantAccountIDs?.length === 1 && Number(report?.participantAccountIDs?.[0]) === CONST.ACCOUNT_ID.CONCIERGE && !isChatThread(report);
}

/**
 * Check if the report is a single chat report that isn't a thread
 * and personal detail of participant is optimistic data
 */
function shouldDisableDetailPage(report: OnyxEntry<Report>): boolean {
    const participantAccountIDs = report?.participantAccountIDs ?? [];

    if (isChatRoom(report) || isPolicyExpenseChat(report) || isChatThread(report) || isTaskReport(report)) {
        return false;
    }
    if (participantAccountIDs.length === 1) {
        return isOptimisticPersonalDetail(participantAccountIDs[0]);
    }
    return false;
}

/**
 * Returns true if this report has only one participant and it's an Expensify account.
 */
function isExpensifyOnlyParticipantInReport(report: OnyxEntry<Report>): boolean {
    const reportParticipants = report?.participantAccountIDs?.filter((accountID) => accountID !== currentUserAccountID) ?? [];
    return reportParticipants.length === 1 && reportParticipants.some((accountID) => CONST.EXPENSIFY_ACCOUNT_IDS.includes(accountID));
}

/**
 * Returns true if there are any Expensify accounts (i.e. with domain 'expensify.com') in the set of accountIDs
 * by cross-referencing the accountIDs with personalDetails.
 */
function hasExpensifyEmails(accountIDs: number[]): boolean {
    return accountIDs.some((accountID) => Str.extractCompanyNameFromEmailDomain(allPersonalDetails?.[accountID]?.login ?? '') === CONST.EXPENSIFY_PARTNER_NAME);
}

/**
 * Returns true if there are any guides accounts (team.expensify.com) in a list of accountIDs
 * by cross-referencing the accountIDs with personalDetails since guides that are participants
 * of the user's chats should have their personal details in Onyx.
 */
function hasExpensifyGuidesEmails(accountIDs: number[]): boolean {
    return accountIDs.some((accountID) => Str.extractCompanyNameFromEmailDomain(allPersonalDetails?.[accountID]?.login ?? '') === CONST.EMAIL.GUIDES_DOMAIN);
}

function findLastAccessedReport(
    reports: OnyxCollection<Report>,
    ignoreDomainRooms: boolean,
    policies: OnyxCollection<Policy>,
    isFirstTimeNewExpensifyUser: boolean,
    openOnAdminRoom = false,
): OnyxEntry<Report> | undefined {
    // If it's the user's first time using New Expensify, then they could either have:
    //   - just a Concierge report, if so we'll return that
    //   - their Concierge report, and a separate report that must have deeplinked them to the app before they created their account.
    // If it's the latter, we'll use the deeplinked report over the Concierge report,
    // since the Concierge report would be incorrectly selected over the deep-linked report in the logic below.
    let sortedReports = sortReportsByLastRead(reports);

    let adminReport;
    if (openOnAdminRoom) {
        adminReport = sortedReports.find((report) => {
            const chatType = getChatType(report);
            return chatType === CONST.REPORT.CHAT_TYPE.POLICY_ADMINS;
        });
    }

    if (isFirstTimeNewExpensifyUser) {
        if (sortedReports.length === 1) {
            return sortedReports[0];
        }

        return adminReport ?? sortedReports.find((report) => !isConciergeChatReport(report));
    }

    if (ignoreDomainRooms) {
        // We allow public announce rooms, admins, and announce rooms through since we bypass the default rooms beta for them.
        // Check where ReportUtils.findLastAccessedReport is called in MainDrawerNavigator.js for more context.
        // Domain rooms are now the only type of default room that are on the defaultRooms beta.
        sortedReports = sortedReports.filter(
            (report) => !isDomainRoom(report) || getPolicyType(report, policies) === CONST.POLICY.TYPE.FREE || hasExpensifyGuidesEmails(report?.participantAccountIDs ?? []),
        );
    }

    return adminReport ?? sortedReports[sortedReports.length - 1];
}

/**
 * Whether the provided report is an archived room
 */
function isArchivedRoom(report: OnyxEntry<Report> | undefined): boolean {
    return report?.statusNum === CONST.REPORT.STATUS.CLOSED && report?.stateNum === CONST.REPORT.STATE_NUM.SUBMITTED;
}

/**
 * Checks if the current user is allowed to comment on the given report.
 */
function isAllowedToComment(report: OnyxEntry<Report> | undefined): boolean {
    // Default to allowing all users to post
    const capability = (report?.writeCapability ?? CONST.REPORT.WRITE_CAPABILITIES.ALL) || CONST.REPORT.WRITE_CAPABILITIES.ALL;

    if (capability === CONST.REPORT.WRITE_CAPABILITIES.ALL) {
        return true;
    }

    // If unauthenticated user opens public chat room using deeplink, they do not have policies available and they cannot comment
    if (!allPolicies) {
        return false;
    }

    // If we've made it here, commenting on this report is restricted.
    // If the user is an admin, allow them to post.
    const policy = allPolicies[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
    return (policy?.role ?? '') === CONST.POLICY.ROLE.ADMIN;
}

/**
 * Checks if the current user is the admin of the policy given the policy expense chat.
 */
function isPolicyExpenseChatAdmin(report: OnyxEntry<Report>, policies: OnyxCollection<Policy>): boolean {
    if (!isPolicyExpenseChat(report)) {
        return false;
    }

    const policyRole = policies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.role ?? '';

    return policyRole === CONST.POLICY.ROLE.ADMIN;
}

/**
 * Checks if the current user is the admin of the policy.
 */
function isPolicyAdmin(policyID: string, policies: OnyxCollection<Policy>): boolean {
    const policyRole = policies?.[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`]?.role ?? '';

    return policyRole === CONST.POLICY.ROLE.ADMIN;
}

/**
 * Returns true if report is a DM/Group DM chat.
 */
function isDM(report?: OnyxEntry<Report>): boolean {
    return !getChatType(report);
}

/**
 * Returns true if report has a single participant.
 */
function hasSingleParticipant(report?: OnyxEntry<Report>): boolean {
    return report?.participantAccountIDs?.length === 1;
}

/**
 * Checks whether all the transactions linked to the IOU report are of the Distance Request type
 *
 * @param {string|null} iouReportID
 * @returns {boolean}
 */
function hasOnlyDistanceRequestTransactions(iouReportID) {
    const allTransactions = TransactionUtils.getAllReportTransactions(iouReportID);
    return _.all(allTransactions, (transaction) => TransactionUtils.isDistanceRequest(transaction));
}

/**
 * If the report is a thread and has a chat type set, it is a workspace chat.
 */
function isWorkspaceThread(report: OnyxEntry<Report>): boolean {
    return Boolean(isThread(report) && !isDM(report));
}

/**
 * Returns true if reportAction is the first chat preview of a Thread
 */
function isThreadFirstChat(reportAction: OnyxEntry<ReportAction>, reportID: string): boolean {
    return reportAction?.childReportID?.toString() === reportID;
}

/**
 * Checks if a report is a child report.
 */
function isChildReport(report: OnyxEntry<Report>): boolean {
    return isThread(report) || isTaskReport(report);
}

/**
 * An Expense Request is a thread where the parent report is an Expense Report and
 * the parentReportAction is a transaction.
 */
function isExpenseRequest(report?: OnyxEntry<Report>): boolean {
    if (report && isThread(report)) {
        const parentReportAction = ReportActionsUtils.getParentReportAction(report);
        const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`];
        return isExpenseReport(parentReport) && isTypeReportAction(parentReportAction) && ReportActionsUtils.isTransactionThread(parentReportAction);
    }
    return false;
}

/**
 * An IOU Request is a thread where the parent report is an IOU Report and
 * the parentReportAction is a transaction.
 */
function isIOURequest(report?: OnyxEntry<Report>): boolean {
    if (report && isThread(report)) {
        const parentReportAction = ReportActionsUtils.getParentReportAction(report);
        const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`];
        return isIOUReport(parentReport) && isTypeReportAction(parentReportAction) && ReportActionsUtils.isTransactionThread(parentReportAction);
    }
    return false;
}

/**
 * Checks if a report is an IOU or expense request.
 */
function isMoneyRequest(reportOrID: OnyxEntry<Report> | string): boolean {
    const report = typeof reportOrID === 'object' ? reportOrID : allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportOrID}`];
    return isIOURequest(report) || isExpenseRequest(report);
}

/**
 * Checks if a report is an IOU or expense report.
 */
function isMoneyRequestReport(reportOrID?: OnyxEntry<Report> | string): boolean {
    const report = typeof reportOrID === 'object' ? reportOrID : allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportOrID}`];
    return isIOUReport(report) || isExpenseReport(report);
}

/**
 * Get the report given a reportID
 */
function getReport(reportID: string | undefined): OnyxEntry<Report> | undefined {
    // Deleted reports are set to null and lodashGet will still return null in that case, so we need to add an extra check
    return allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
}

/**
 * Can only delete if the author is this user and the action is an ADDCOMMENT action or an IOU action in an unsettled report, or if the user is a
 * policy admin
 */
function canDeleteReportAction(reportAction: OnyxEntry<ReportAction>, reportID: string): boolean {
    const report = getReport(reportID);

    const isActionOwner = reportAction?.actorAccountID === currentUserAccountID;

    if (ReportActionsUtils.isMoneyRequestAction(reportAction)) {
        const originalMessage = reportAction?.originalMessage as IOUMessage;
        // For now, users cannot delete split actions
        const isSplitAction = originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.SPLIT;

        if (isSplitAction || isSettled(String(originalMessage?.IOUReportID)) || isReportApproved(report)) {
            return false;
        }

        if (isActionOwner) {
            return true;
        }
    }

    if (
        reportAction?.actionName !== CONST.REPORT.ACTIONS.TYPE.ADDCOMMENT ||
        reportAction?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE ||
        ReportActionsUtils.isCreatedTaskReportAction(reportAction) ||
        reportAction.actorAccountID === CONST.ACCOUNT_ID.CONCIERGE
    ) {
        return false;
    }

    const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
    const isAdmin = policy?.role === CONST.POLICY.ROLE.ADMIN && !isDM(report);

    return isActionOwner || isAdmin;
}

/**
 * Get welcome message based on room type
 */
function getRoomWelcomeMessage(report: OnyxEntry<Report>, isUserPolicyAdmin: boolean): WelcomeMessage {
    const welcomeMessage: WelcomeMessage = {showReportName: true};
    const workspaceName = getPolicyName(report);

    if (isArchivedRoom(report)) {
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfArchivedRoomPartOne');
        welcomeMessage.phrase2 = Localize.translateLocal('reportActionsView.beginningOfArchivedRoomPartTwo');
    } else if (isDomainRoom(report)) {
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryDomainRoomPartOne', {domainRoom: report?.reportName});
        welcomeMessage.phrase2 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryDomainRoomPartTwo');
    } else if (isAdminRoom(report)) {
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryAdminRoomPartOne', {workspaceName});
        welcomeMessage.phrase2 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryAdminRoomPartTwo');
    } else if (isAdminsOnlyPostingRoom(report) && !isUserPolicyAdmin) {
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryAdminOnlyPostingRoom');
        welcomeMessage.showReportName = false;
    } else if (isAnnounceRoom(report)) {
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryAnnounceRoomPartOne', {workspaceName});
        welcomeMessage.phrase2 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryAnnounceRoomPartTwo', {workspaceName});
    } else {
        // Message for user created rooms or other room types.
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryUserRoomPartOne');
        welcomeMessage.phrase2 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryUserRoomPartTwo');
    }

    return welcomeMessage;
}

/**
 * Returns true if Concierge is one of the chat participants (1:1 as well as group chats)
 */
function chatIncludesConcierge(report: OnyxEntry<Report>): boolean {
    return Boolean((report?.participantAccountIDs?.length ?? 0) > 0 && report?.participantAccountIDs?.includes(CONST.ACCOUNT_ID.CONCIERGE));
}

/**
 * Returns true if there is any automated expensify account `in accountIDs
 */
function hasAutomatedExpensifyAccountIDs(accountIDs: number[]): boolean {
    return accountIDs.filter((accountID) => CONST.EXPENSIFY_ACCOUNT_IDS.includes(accountID)).length > 0;
}

function getReportRecipientAccountIDs(report: OnyxEntry<Report>, currentLoginAccountID: number): number[] {
    let finalReport: OnyxEntry<Report> | undefined = report;
    // In 1:1 chat threads, the participants will be the same as parent report. If a report is specifically a 1:1 chat thread then we will
    // get parent report and use its participants array.
    if (isThread(report) && !(isTaskReport(report) || isMoneyRequestReport(report))) {
        const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`];
        if (hasSingleParticipant(parentReport)) {
            finalReport = parentReport;
        }
    }

    let finalParticipantAccountIDs: number[] | undefined = [];
    if (isMoneyRequestReport(report)) {
        // For money requests i.e the IOU (1:1 person) and Expense (1:* person) reports, use the full `initialParticipantAccountIDs` array
        // and add the `ownerAccountId`. Money request reports don't add `ownerAccountId` in `participantAccountIDs` array
        const defaultParticipantAccountIDs = finalReport?.participantAccountIDs ?? [];
        const setOfParticipantAccountIDs = new Set<number>(report?.ownerAccountID ? [...defaultParticipantAccountIDs, report.ownerAccountID] : defaultParticipantAccountIDs);
        finalParticipantAccountIDs = [...setOfParticipantAccountIDs];
        // Task reports `managerID` will change when assignee is changed, in that case the old `managerID` is still present in `participantAccountIDs`
        // array along with the new one. We only need the `managerID` as a participant here.
        finalParticipantAccountIDs = report?.managerID ? [report?.managerID] : [];
    } else {
        finalParticipantAccountIDs = finalReport?.participantAccountIDs;
    }

    const reportParticipants = finalParticipantAccountIDs?.filter((accountID) => accountID !== currentLoginAccountID) ?? [];
    const participantsWithoutExpensifyAccountIDs = reportParticipants.filter((participant) => !CONST.EXPENSIFY_ACCOUNT_IDS.includes(participant ?? 0));
    return participantsWithoutExpensifyAccountIDs;
}

/**
 * Whether the time row should be shown for a report.
 */
function canShowReportRecipientLocalTime(personalDetails: OnyxCollection<PersonalDetails>, report: OnyxEntry<Report>, accountID: number): boolean {
    const reportRecipientAccountIDs = getReportRecipientAccountIDs(report, accountID);
    const hasMultipleParticipants = reportRecipientAccountIDs.length > 1;
    const reportRecipient = personalDetails?.[reportRecipientAccountIDs[0] ?? -1];
    const reportRecipientTimezone = reportRecipient?.timezone ?? CONST.DEFAULT_TIME_ZONE;
    const isReportParticipantValidated = reportRecipient?.validated ?? false;
    return Boolean(!hasMultipleParticipants && !isChatRoom(report) && !isPolicyExpenseChat(report) && reportRecipient && reportRecipientTimezone?.selected && isReportParticipantValidated);
}

/**
 * Shorten last message text to fixed length and trim spaces.
 */
function formatReportLastMessageText(lastMessageText: string, isModifiedExpenseMessage = false): string {
    if (isModifiedExpenseMessage) {
        return String(lastMessageText).trim().replace(CONST.REGEX.LINE_BREAK, '').trim();
    }
    return String(lastMessageText).trim().replace(CONST.REGEX.AFTER_FIRST_LINE_BREAK, '').substring(0, CONST.REPORT.LAST_MESSAGE_TEXT_MAX_LENGTH).trim();
}

/**
 * Helper method to return the default avatar associated with the given login
 */
function getDefaultWorkspaceAvatar(workspaceName?: string): React.FC<SvgProps> {
    if (!workspaceName) {
        return defaultWorkspaceAvatars.WorkspaceBuilding;
    }

    // Remove all chars not A-Z or 0-9 including underscore
    const alphaNumeric = workspaceName
        .normalize('NFD')
        .replace(/[^0-9a-z]/gi, '')
        .toUpperCase();

    const workspace = `Workspace${alphaNumeric[0]}` as keyof typeof defaultWorkspaceAvatars;
    const defaultWorkspaceAvatar = defaultWorkspaceAvatars[workspace];

    return !alphaNumeric ? defaultWorkspaceAvatars.WorkspaceBuilding : defaultWorkspaceAvatar;
}

function getWorkspaceAvatar(report: OnyxEntry<Report>) {
    const workspaceName = getPolicyName(report, false, allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]);
    return allPolicies?.[`policy${report?.policyID}`]?.avatar ?? getDefaultWorkspaceAvatar(workspaceName);
}

/**
 * Returns the appropriate icons for the given chat report using the stored personalDetails.
 * The Avatar sources can be URLs or Icon components according to the chat type.
 */
function getIconsForParticipants(participants: number[], personalDetails: OnyxCollection<PersonalDetails>) {
    const participantDetails: Array<[number, string, string | React.FC<SvgProps>, string | React.FC<SvgProps>]> = [];
    const participantsList = participants || [];

    for (const accountID of participantsList) {
        const avatarSource = UserUtils.getAvatar(personalDetails?.[accountID]?.avatar ?? '', accountID);
        const displayNameLogin = personalDetails?.[accountID]?.displayName ? personalDetails?.[accountID]?.displayName : personalDetails?.[accountID]?.login;
        participantDetails.push([accountID, displayNameLogin ?? '', avatarSource, personalDetails?.[accountID]?.fallbackIcon ?? '']);
    }

    const sortedParticipantDetails = participantDetails.sort((first, second) => {
        // First sort by displayName/login
        const displayNameLoginOrder = first[1].localeCompare(second[1]);
        if (displayNameLoginOrder !== 0) {
            return displayNameLoginOrder;
        }

        // Then fallback on accountID as the final sorting criteria.
        // This will ensure that the order of avatars with same login/displayName
        // stay consistent across all users and devices
        return first[0] - second[0];
    });

    // Now that things are sorted, gather only the avatars (second element in the array) and return those
    const avatars: Avatar[] = [];

    for (const sortedParticipantDetail of sortedParticipantDetails) {
        const userIcon = {
            id: sortedParticipantDetail[0],
            source: sortedParticipantDetail[2],
            type: CONST.ICON_TYPE_AVATAR,
            name: sortedParticipantDetail[1],
            fallbackIcon: sortedParticipantDetail[3],
        };
        avatars.push(userIcon);
    }

    return avatars;
}

/**
 * Given a report, return the associated workspace icon.
 */
function getWorkspaceIcon(report: OnyxEntry<Report>, policy: OnyxEntry<Policy> | undefined = undefined): Avatar {
    const workspaceName = getPolicyName(report, false, policy);
    // TODO: Check why ?? is not working here
    const policyExpenseChatAvatarSource = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.avatar
        ? allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.avatar
        : getDefaultWorkspaceAvatar(workspaceName);

    const workspaceIcon = {
        source: policyExpenseChatAvatarSource,
        type: CONST.ICON_TYPE_WORKSPACE,
        name: workspaceName,
        id: -1,
    };
    return workspaceIcon;
}

/**
 * Returns the appropriate icons for the given chat report using the stored personalDetails.
 * The Avatar sources can be URLs or Icon components according to the chat type.
 */
function getIcons(
    report: OnyxEntry<Report>,
    personalDetails: OnyxCollection<PersonalDetails>,
    defaultIcon: string | React.FC<SvgProps> | null = null,
    defaultName = '',
    defaultAccountID = -1,
    policy: OnyxEntry<Policy> | undefined = undefined,
) {
    if (Object.keys(report ?? {}).length === 0) {
        const fallbackIcon: Avatar = {
            source: defaultIcon ?? Expensicons.FallbackAvatar,
            type: CONST.ICON_TYPE_AVATAR,
            name: defaultName,
            id: defaultAccountID,
        };
        return [fallbackIcon];
    }
    if (isExpenseRequest(report)) {
        const parentReportAction = ReportActionsUtils.getParentReportAction(report);
        const workspaceIcon = getWorkspaceIcon(report, policy);
        const memberIcon = {
            source: UserUtils.getAvatar(personalDetails?.[parentReportAction.actorAccountID ?? -1]?.avatar ?? '', parentReportAction.actorAccountID ?? -1),
            id: parentReportAction.actorAccountID,
            type: CONST.ICON_TYPE_AVATAR,
            name: personalDetails?.[parentReportAction.actorAccountID ?? -1]?.displayName ?? '',
            fallbackIcon: personalDetails?.[parentReportAction.actorAccountID ?? -1]?.fallbackIcon,
        };

        return [memberIcon, workspaceIcon];
    }
    if (isChatThread(report)) {
        const parentReportAction = ReportActionsUtils.getParentReportAction(report);

        const actorAccountID = parentReportAction.actorAccountID;
        const actorDisplayName = allPersonalDetails?.[actorAccountID ?? -1]?.displayName ?? '';
        const actorIcon = {
            id: actorAccountID,
            source: UserUtils.getAvatar(personalDetails?.[actorAccountID ?? -1]?.avatar ?? '', actorAccountID ?? -1),
            name: actorDisplayName,
            type: CONST.ICON_TYPE_AVATAR,
            fallbackIcon: personalDetails?.[parentReportAction.actorAccountID ?? -1]?.fallbackIcon,
        };

        if (isWorkspaceThread(report)) {
            const workspaceIcon = getWorkspaceIcon(report, policy);
            return [actorIcon, workspaceIcon];
        }
        return [actorIcon];
    }
    if (isTaskReport(report)) {
        const ownerIcon = {
            id: report?.ownerAccountID,
            source: UserUtils.getAvatar(personalDetails?.[report?.ownerAccountID ?? -1]?.avatar ?? '', report?.ownerAccountID ?? -1),
            type: CONST.ICON_TYPE_AVATAR,
            name: personalDetails?.[report?.ownerAccountID ?? -1]?.displayName ?? '',
            fallbackIcon: personalDetails?.[report?.ownerAccountID ?? -1]?.fallbackIcon,
        };

        if (isWorkspaceTaskReport(report)) {
            const workspaceIcon = getWorkspaceIcon(report, policy);
            return [ownerIcon, workspaceIcon];
        }

        return [ownerIcon];
    }
    if (isDomainRoom(report)) {
        // Get domain name after the #. Domain Rooms use our default workspace avatar pattern.
        const domainName = report?.reportName?.substring(1);
        const policyExpenseChatAvatarSource = getDefaultWorkspaceAvatar(domainName);
        const domainIcon = {
            source: policyExpenseChatAvatarSource,
            type: CONST.ICON_TYPE_WORKSPACE,
            name: domainName,
            id: -1,
        };
        return [domainIcon];
    }
    if (isAdminRoom(report) || isAnnounceRoom(report) || isChatRoom(report) || isArchivedRoom(report)) {
        const workspaceIcon = getWorkspaceIcon(report, policy);
        return [workspaceIcon];
    }
    if (isPolicyExpenseChat(report) || isExpenseReport(report)) {
        const workspaceIcon = getWorkspaceIcon(report, policy);
        const memberIcon = {
            source: UserUtils.getAvatar(personalDetails?.[report?.ownerAccountID ?? -1]?.avatar ?? '', report?.ownerAccountID ?? -1),
            id: report?.ownerAccountID,
            type: CONST.ICON_TYPE_AVATAR,
            name: personalDetails?.[report?.ownerAccountID ?? -1]?.displayName ?? '',
            fallbackIcon: personalDetails?.[report?.ownerAccountID ?? -1]?.fallbackIcon,
        };
        return isExpenseReport(report) ? [memberIcon, workspaceIcon] : [workspaceIcon, memberIcon];
    }
    if (isIOUReport(report)) {
        const managerIcon = {
            source: UserUtils.getAvatar(personalDetails?.[report?.managerID ?? -1]?.avatar ?? '', report?.managerID ?? -1),
            id: report?.managerID,
            type: CONST.ICON_TYPE_AVATAR,
            name: personalDetails?.[report?.managerID ?? -1]?.displayName ?? '',
            fallbackIcon: personalDetails?.[report?.managerID ?? -1]?.fallbackIcon,
        };
        const ownerIcon = {
            id: report?.ownerAccountID,
            source: UserUtils.getAvatar(personalDetails?.[report?.ownerAccountID ?? -1]?.avatar ?? '', report?.ownerAccountID ?? -1),
            type: CONST.ICON_TYPE_AVATAR,
            name: personalDetails?.[report?.ownerAccountID ?? -1]?.displayName ?? '',
            fallbackIcon: personalDetails?.[report?.ownerAccountID ?? -1]?.fallbackIcon,
        };
        const isPayer = currentUserAccountID === report?.managerID;

        return isPayer ? [managerIcon, ownerIcon] : [ownerIcon, managerIcon];
    }

    return getIconsForParticipants(report?.participantAccountIDs ?? [], personalDetails);
}

/**
 * Gets the personal details for a login by looking in the ONYXKEYS.PERSONAL_DETAILS_LIST Onyx key (stored in the local variable, allPersonalDetails). If it doesn't exist in Onyx,
 * then a default object is constructed.
 */
function getPersonalDetailsForAccountID(accountID: number): PersonalDetails | Record<string, never> | {avatar: string | React.FC<SvgProps>} {
    if (!accountID) {
        return {};
    }
    if (Number(accountID) === CONST.ACCOUNT_ID.CONCIERGE) {
        return {
            accountID,
            displayName: 'Concierge',
            login: CONST.EMAIL.CONCIERGE,
            avatar: UserUtils.getDefaultAvatar(accountID),
        };
    }
    return (
        allPersonalDetails?.[accountID] ?? {
            avatar: UserUtils.getDefaultAvatar(accountID),
        }
    );
}

/**
 * Get the displayName for a single report participant.
 */
function getDisplayNameForParticipant(accountID?: number, shouldUseShortForm = false) {
    if (!accountID) {
        return '';
    }
    const personalDetails = getPersonalDetailsForAccountID(accountID);
    if ('displayName' in personalDetails) {
        const longName = personalDetails.displayName;
        const shortName = personalDetails.firstName ? personalDetails?.firstName : longName;
        return shouldUseShortForm ? shortName : longName;
    }
}

function getDisplayNamesWithTooltips(
    personalDetailsList: PersonalDetails[],
    isMultipleParticipantReport: boolean,
): Array<Pick<PersonalDetails, 'accountID' | 'pronouns' | 'displayName' | 'login' | 'avatar'>> {
    return personalDetailsList?.map?.((user) => {
        const accountID = Number(user.accountID);
        const displayName = getDisplayNameForParticipant(accountID, isMultipleParticipantReport) ?? user.login ?? '';
        const avatar = UserUtils.getDefaultAvatar(accountID);

        let pronouns = user.pronouns;
        if (pronouns && pronouns.startsWith(CONST.PRONOUNS.PREFIX)) {
            const pronounTranslationKey = pronouns.replace(CONST.PRONOUNS.PREFIX, '');
            pronouns = Localize.translateLocal(`pronouns.${pronounTranslationKey}`);
        }

        return {
            displayName,
            avatar,
            login: user.login ?? '',
            accountID,
            pronouns,
        };
    });
}

/**
 * For a deleted parent report action within a chat report,
 * let us return the appropriate display message
 *
 * @param reportAction - The deleted report action of a chat report for which we need to return message.
 */
function getDeletedParentActionMessageForChatReport(reportAction: OnyxEntry<ReportAction>): string {
    // By default, let us display [Deleted message]
    let deletedMessageText = Localize.translateLocal('parentReportAction.deletedMessage');
    if (ReportActionsUtils.isCreatedTaskReportAction(reportAction)) {
        // For canceled task report, let us display [Deleted task]
        deletedMessageText = Localize.translateLocal('parentReportAction.deletedTask');
    }
    return deletedMessageText;
}

/**
 * Returns the last visible message for a given report after considering the given optimistic actions
 *
 * @param reportID - the report for which last visible message has to be fetched
 * @param [actionsToMerge] - the optimistic merge actions that needs to be considered while fetching last visible message

 */
function getLastVisibleMessage(reportID: string | undefined, actionsToMerge: ReportActions = {}) {
    const report = getReport(reportID);
    const lastVisibleAction = ReportActionsUtils.getLastVisibleAction(reportID ?? '', actionsToMerge);

    // For Chat Report with deleted parent actions, let us fetch the correct message
    if (ReportActionsUtils.isDeletedParentAction(lastVisibleAction) && report && isChatReport(report)) {
        const lastMessageText = getDeletedParentActionMessageForChatReport(lastVisibleAction);
        return {
            lastMessageText,
        };
    }

    // Fetch the last visible message for report represented by reportID and based on actions to merge.
    return ReportActionsUtils.getLastVisibleMessage(reportID ?? '', actionsToMerge);
}

/**
 * Determines if a report has an IOU that is waiting for an action from the current user (either Pay or Add a credit bank account)
 */
function isWaitingForIOUActionFromCurrentUser(report: OnyxEntry<Report>): boolean {
    if (!report) {
        return false;
    }

    if (isArchivedRoom(getReport(report.parentReportID))) {
        return false;
    }

    const policy = getPolicy(report?.policyID ?? '');
    if (policy?.type === CONST.POLICY.TYPE.CORPORATE) {
        // If the report is already settled, there's no action required from any user.
        if (isSettled(report.reportID)) {
            return false;
        }

        // Report is pending approval and the current user is the manager
        if (isReportManager(report) && !isReportApproved(report)) {
            return true;
        }

        // Current user is an admin and the report has been approved but not settled yet
        return policy.role === CONST.POLICY.ROLE.ADMIN && isReportApproved(report);
    }

    // Money request waiting for current user to add their credit bank account
    if (report.hasOutstandingIOU && report.ownerAccountID === currentUserAccountID && report.isWaitingOnBankAccount) {
        return true;
    }

    // Money request waiting for current user to Pay (from expense or iou report)
    if (report.hasOutstandingIOU && report.ownerAccountID && (report.ownerAccountID !== currentUserAccountID || currentUserAccountID === report.managerID)) {
        return true;
    }

    return false;
}

/**
 * Checks if a report is an open task report assigned to current user.
 *
 * @param report
 * @param  parentReportAction - The parent report action of the report (Used to check if the task has been canceled)
 */
function isWaitingForTaskCompleteFromAssignee(report: OnyxEntry<Report>, parentReportAction?: OnyxEntry<ReportAction>): boolean {
    return isTaskReport(report) && isReportManager(report) && isOpenTaskReport(report, parentReportAction);
}

/**
 * Returns number of transactions that are nonReimbursable
 *
 */
function hasNonReimbursableTransactions(iouReportID: string | undefined) {
    const allTransactions = TransactionUtils.getAllReportTransactions(iouReportID);
    return allTransactions.filter((transaction) => transaction.reimbursable === false).length > 0;
}

function getMoneyRequestReimbursableTotal(report: OnyxEntry<Report> | undefined, allReportsDict?: OnyxCollection<Report>): number {
    const allAvailableReports = allReportsDict ?? allReports;
    let moneyRequestReport;
    if (isMoneyRequestReport(report)) {
        moneyRequestReport = report;
    }
    if (allAvailableReports && report?.hasOutstandingIOU && report?.iouReportID) {
        moneyRequestReport = allAvailableReports[`${ONYXKEYS.COLLECTION.REPORT}${report.iouReportID}`];
    }
    if (moneyRequestReport) {
        const total = moneyRequestReport.total ?? 0;

        if (total !== 0) {
            // There is a possibility that if the Expense report has a negative total.
            // This is because there are instances where you can get a credit back on your card,
            // or you enter a negative expense to “offset” future expenses
            return isExpenseReport(moneyRequestReport) ? total * -1 : Math.abs(total);
        }
    }
    return 0;
}

function getMoneyRequestSpendBreakdown(report: OnyxEntry<Report>, allReportsDict: OnyxCollection<Report> = null) {
    const allAvailableReports = allReportsDict ?? allReports;
    let moneyRequestReport;
    if (isMoneyRequestReport(report)) {
        moneyRequestReport = report;
    }
    if (allAvailableReports && report?.hasOutstandingIOU && report?.iouReportID) {
        moneyRequestReport = allAvailableReports[`${ONYXKEYS.COLLECTION.REPORT}${report.iouReportID}`];
    }
    if (moneyRequestReport) {
        let nonReimbursableSpend = moneyRequestReport.nonReimbursableTotal ?? 0;
        let reimbursableSpend = moneyRequestReport.total ?? 0;

        if (nonReimbursableSpend + reimbursableSpend !== 0) {
            // There is a possibility that if the Expense report has a negative total.
            // This is because there are instances where you can get a credit back on your card,
            // or you enter a negative expense to “offset” future expenses
            nonReimbursableSpend = isExpenseReport(moneyRequestReport) ? nonReimbursableSpend * -1 : Math.abs(nonReimbursableSpend);
            reimbursableSpend = isExpenseReport(moneyRequestReport) ? reimbursableSpend * -1 : Math.abs(reimbursableSpend);
            const totalDisplaySpend = nonReimbursableSpend + reimbursableSpend;
            return {
                nonReimbursableSpend,
                reimbursableSpend,
                totalDisplaySpend,
            };
        }
    }
    return {
        nonReimbursableSpend: 0,
        reimbursableSpend: 0,
        totalDisplaySpend: 0,
    };
}

/**
 * Get the title for a policy expense chat which depends on the role of the policy member seeing this report
 */
function getPolicyExpenseChatName(report: OnyxEntry<Report>, policy: OnyxEntry<Policy> | undefined = undefined): string | undefined {
    const reportOwnerDisplayName = getDisplayNameForParticipant(report?.ownerAccountID ?? -1) ?? allPersonalDetails?.[report?.ownerAccountID ?? -1]?.login ?? report?.reportName;

    // If the policy expense chat is owned by this user, use the name of the policy as the report name.
    if (report?.isOwnPolicyExpenseChat) {
        return getPolicyName(report, false, policy);
    }

    const policyExpenseChatRole = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.role ?? 'user';

    // If this user is not admin and this policy expense chat has been archived because of account merging, this must be an old workspace chat
    // of the account which was merged into the current user's account. Use the name of the policy as the name of the report.
    if (isArchivedRoom(report)) {
        const lastAction = ReportActionsUtils.getLastVisibleAction(report?.reportID ?? '');
        const originalMessage = lastAction?.originalMessage as Closed;
        const archiveReason = originalMessage?.reason ?? CONST.REPORT.ARCHIVE_REASON.DEFAULT;
        if (archiveReason === CONST.REPORT.ARCHIVE_REASON.ACCOUNT_MERGED && policyExpenseChatRole !== CONST.POLICY.ROLE.ADMIN) {
            return getPolicyName(report, false, policy);
        }
    }

    // If user can see this report and they are not its owner, they must be an admin and the report name should be the name of the policy member
    return reportOwnerDisplayName;
}

/**
 * Get the title for an IOU or expense chat which will be showing the payer and the amount
 *
 */
function getMoneyRequestReportName(report: OnyxEntry<Report>, policy: OnyxEntry<Policy> | undefined = undefined) {
    const moneyRequestTotal = getMoneyRequestReimbursableTotal(report);
    const formattedAmount = CurrencyUtils.convertToDisplayString(moneyRequestTotal, report?.currency, hasOnlyDistanceRequestTransactions(report?.reportID));
    const payerName = isExpenseReport(report) ? getPolicyName(report, false, policy) : getDisplayNameForParticipant(report?.managerID);
    const payerPaidAmountMessage = Localize.translateLocal('iou.payerPaidAmount', {
        payer: payerName,
        amount: formattedAmount,
    });

    if (report?.isWaitingOnBankAccount) {
        return `${payerPaidAmountMessage} • ${Localize.translateLocal('iou.pending')}`;
    }

    if (hasNonReimbursableTransactions(report?.reportID)) {
        return Localize.translateLocal('iou.payerSpentAmount', {payer: payerName, amount: formattedAmount});
    }

    if (report?.hasOutstandingIOU || moneyRequestTotal === 0) {
        return Localize.translateLocal('iou.payerOwesAmount', {payer: payerName, amount: formattedAmount});
    }

    return payerPaidAmountMessage;
}

/**
 * Gets transaction created, amount, currency, comment, and waypoints (for distance request)
 * into a flat object. Used for displaying transactions and sending them in API commands
 */

function getTransactionDetails(transaction: OnyxEntry<Transaction>, createdDateFormat: string = CONST.DATE.FNS_FORMAT_STRING) {
    const report = getReport(transaction?.reportID);
    if (!transaction) {
        return;
    }
    return {
        created: TransactionUtils.getCreated(transaction, createdDateFormat),
        amount: TransactionUtils.getAmount(transaction, isExpenseReport(report)),
        currency: TransactionUtils.getCurrency(transaction),
        comment: TransactionUtils.getDescription(transaction),
        merchant: TransactionUtils.getMerchant(transaction),
        waypoints: TransactionUtils.getWaypoints(transaction),
        category: TransactionUtils.getCategory(transaction),
        billable: TransactionUtils.getBillable(transaction),
        tag: TransactionUtils.getTag(transaction),
        mccGroup: TransactionUtils.getMCCGroup(transaction),
        cardID: TransactionUtils.getCardID(transaction),
        originalAmount: TransactionUtils.getOriginalAmount(transaction),
        originalCurrency: TransactionUtils.getOriginalCurrency(transaction),
    };
}

/**
 * Can only edit if:
 *
 * - in case of IOU report
 *    - the current user is the requestor
 * - in case of expense report
 *    - the current user is the requestor
 *    - or the user is an admin on the policy the expense report is tied to
 */
function canEditMoneyRequest(reportAction: OnyxEntry<ReportAction>): boolean {
    // If the report action i snot IOU type, return true early
    if (reportAction?.actionName !== CONST.REPORT.ACTIONS.TYPE.IOU) {
        return true;
    }
    const moneyRequestReportID = reportAction.originalMessage.IOUReportID ?? 0;
    if (!moneyRequestReportID) {
        return false;
    }
    const moneyRequestReport = getReport(String(moneyRequestReportID));
    const isReportSettled = isSettled(moneyRequestReport?.reportID ?? '');
    const isAdmin = isExpenseReport(moneyRequestReport) && (getPolicy(moneyRequestReport?.policyID ?? '')?.role ?? '') === CONST.POLICY.ROLE.ADMIN;
    const isRequestor = currentUserAccountID === reportAction.actorAccountID;
    return !isReportSettled && (isAdmin || isRequestor);
}

/**
 * Can only edit if:
 *
 * - It was written by the current user
 * - It's an ADDCOMMENT that is not an attachment
 * - It's money request where conditions for editability are defined in canEditMoneyRequest method
 * - It's not pending deletion
 */
function canEditReportAction(reportAction: OnyxEntry<ReportAction>): boolean {
    const isCommentOrIOU = reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.ADDCOMMENT || reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.IOU;

    return Boolean(
        reportAction?.actorAccountID === currentUserAccountID &&
            isCommentOrIOU &&
            canEditMoneyRequest(reportAction) && // Returns true for non-IOU actions
            reportAction?.message &&
            !isReportMessageAttachment(reportAction.message[0] ?? {}) &&
            !ReportActionsUtils.isDeletedAction(reportAction) &&
            !ReportActionsUtils.isCreatedTaskReportAction(reportAction) &&
            reportAction?.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
    );
}

/**
 * Gets all transactions on an IOU report with a receipt
 */
function getTransactionsWithReceipts(iouReportID: string | undefined): Transaction[] {
    const allTransactions = TransactionUtils.getAllReportTransactions(iouReportID);
    return allTransactions.filter((transaction) => TransactionUtils.hasReceipt(transaction));
}

/**
 * For report previews, we display a "Receipt scan in progress" indicator
 * instead of the report total only when we have no report total ready to show. This is the case when
 * all requests are receipts that are being SmartScanned. As soon as we have a non-receipt request,
 * or as soon as one receipt request is done scanning, we have at least one
 * "ready" money request, and we remove this indicator to show the partial report total.
 */
function areAllRequestsBeingSmartScanned(iouReportID: string | undefined, reportPreviewAction: OnyxEntry<ReportAction>): boolean {
    const transactionsWithReceipts = getTransactionsWithReceipts(iouReportID);
    // If we have more requests than requests with receipts, we have some manual requests
    if (ReportActionsUtils.getNumberOfMoneyRequests(reportPreviewAction) > transactionsWithReceipts.length) {
        return false;
    }
    return transactionsWithReceipts.every((transaction) => TransactionUtils.isReceiptBeingScanned(transaction));
}

/**
 * Check if any of the transactions in the report has required missing fields
 *
 * @param iouReportID
 */
function hasMissingSmartscanFields(iouReportID?: string) {
    const transactionsWithReceipts = getTransactionsWithReceipts(iouReportID);
    return transactionsWithReceipts.some((transaction) => TransactionUtils.hasMissingSmartscanFields(transaction));
}

/**
 * Given a parent IOU report action get report name for the LHN.
 */
function getTransactionReportName(reportAction: OnyxEntry<ReportAction>) {
    if (ReportActionsUtils.isReversedTransaction(reportAction)) {
        return Localize.translateLocal('parentReportAction.reversedTransaction');
    }

    if (ReportActionsUtils.isDeletedAction(reportAction)) {
        return Localize.translateLocal('parentReportAction.deletedRequest');
    }

    const transaction = TransactionUtils.getLinkedTransaction(reportAction);
    if (!isTypeTransaction(transaction)) {
        return '';
    }
    if (TransactionUtils.hasReceipt(transaction) && TransactionUtils.isReceiptBeingScanned(transaction)) {
        return Localize.translateLocal('iou.receiptScanning');
    }

    if (TransactionUtils.hasMissingSmartscanFields(transaction)) {
        return Localize.translateLocal('iou.receiptMissingDetails');
    }

    const transactionDetails = getTransactionDetails(transaction);

    return Localize.translateLocal(ReportActionsUtils.isSentMoneyReportAction(reportAction) ? 'iou.threadSentMoneyReportName' : 'iou.threadRequestReportName', {
        formattedAmount: CurrencyUtils.convertToDisplayString(transactionDetails?.amount ?? 0, transactionDetails?.currency ?? '', TransactionUtils.isDistanceRequest(transaction)),
        comment: transactionDetails?.comment,
    });
}

/**
 * Get money request message for an IOU report
 *
 * @param report
 * @param  [reportAction] This can be either a report preview action or the IOU action
 * @param  [shouldConsiderReceiptBeingScanned=false]
 * @returns
 */
function getReportPreviewMessage(report: OnyxEntry<Report>, reportAction?: OnyxEntry<ReportAction>, shouldConsiderReceiptBeingScanned = false): string {
    const reportActionMessage = reportAction?.message?.[0].html ?? '';

    if (Object.keys(report ?? {}).length === 0 || !report?.reportID) {
        // The iouReport is not found locally after SignIn because the OpenApp API won't return iouReports if they're settled
        // As a temporary solution until we know how to solve this the best, we just use the message that returned from BE
        return reportActionMessage;
    }

    if (!isIOUReport(report) && reportAction && ReportActionsUtils.isSplitBillAction(reportAction)) {
        // This covers group chats where the last action is a split bill action
        const linkedTransaction = TransactionUtils.getLinkedTransaction(reportAction);
        if (Object.keys(linkedTransaction ?? {}).length === 0) {
            return reportActionMessage;
        }

        if (isTypeTransaction(linkedTransaction)) {
            if (TransactionUtils.isReceiptBeingScanned(linkedTransaction)) {
                return Localize.translateLocal('iou.receiptScanning');
            }

            const transactionDetails = getTransactionDetails(linkedTransaction);
            const formattedAmount = CurrencyUtils.convertToDisplayString(transactionDetails?.amount ?? 0, transactionDetails?.currency ?? '');
            return Localize.translateLocal('iou.didSplitAmount', {formattedAmount, comment: transactionDetails?.comment});
        }
    }

    const totalAmount = getMoneyRequestReimbursableTotal(report);
    const payerName = isExpenseReport(report) ? getPolicyName(report) : getDisplayNameForParticipant(report.managerID, true);
    const formattedAmount = CurrencyUtils.convertToDisplayString(totalAmount, report.currency);

    if (isReportApproved(report) && getPolicyType(report, allPolicies) === CONST.POLICY.TYPE.CORPORATE) {
        return `approved ${formattedAmount}`;
    }

    if (shouldConsiderReceiptBeingScanned && reportAction && ReportActionsUtils.isMoneyRequestAction(reportAction)) {
        const linkedTransaction = TransactionUtils.getLinkedTransaction(reportAction);

        if (isTypeTransaction(linkedTransaction) && TransactionUtils.hasReceipt(linkedTransaction) && TransactionUtils.isReceiptBeingScanned(linkedTransaction)) {
            return Localize.translateLocal('iou.receiptScanning');
        }
    }

    if (isSettled(report.reportID)) {
        // A settled report preview message can come in three formats "paid ... elsewhere" or "paid ... with Expensify"
        let translatePhraseKey = 'iou.paidElsewhereWithAmount';
        const originalMessage = reportAction?.originalMessage as IOUMessage;
        if (
            [CONST.IOU.PAYMENT_TYPE.VBBA, CONST.IOU.PAYMENT_TYPE.EXPENSIFY].some((paymentType) => paymentType === originalMessage?.paymentType) ||
            reportActionMessage.match(/ (with Expensify|using Expensify)$/)
        ) {
            translatePhraseKey = 'iou.paidWithExpensifyWithAmount';
        }
        return Localize.translateLocal(translatePhraseKey, {amount: formattedAmount, payer: payerName});
    }

    if (report.isWaitingOnBankAccount) {
        const submitterDisplayName = getDisplayNameForParticipant(report?.ownerAccountID ?? -1, true);
        return Localize.translateLocal('iou.waitingOnBankAccount', {submitterDisplayName});
    }

    const containsNonReimbursable = hasNonReimbursableTransactions(report.reportID);
    return Localize.translateLocal(containsNonReimbursable ? 'iou.payerSpentAmount' : 'iou.payerOwesAmount', {payer: payerName, amount: formattedAmount});
}

/**
 * Get the proper message schema for modified expense message.
 */

function getProperSchemaForModifiedExpenseMessage(newValue: string, oldValue: string, valueName: string, valueInQuotes: boolean) {
    const newValueToDisplay = valueInQuotes ? `"${newValue}"` : newValue;
    const oldValueToDisplay = valueInQuotes ? `"${oldValue}"` : oldValue;
    const displayValueName = valueName.toLowerCase();

    if (!oldValue) {
        return Localize.translateLocal('iou.setTheRequest', {valueName: displayValueName, newValueToDisplay});
    }
    if (!newValue) {
        return Localize.translateLocal('iou.removedTheRequest', {valueName: displayValueName, oldValueToDisplay});
    }
    return Localize.translateLocal('iou.updatedTheRequest', {valueName: displayValueName, newValueToDisplay, oldValueToDisplay});
}

/**
 * Get the proper message schema for modified distance message.
 */
function getProperSchemaForModifiedDistanceMessage(newDistance: string, oldDistance: string, newAmount: string, oldAmount: string) {
    if (!oldDistance) {
        return Localize.translateLocal('iou.setTheDistance', {newDistanceToDisplay: newDistance, newAmountToDisplay: newAmount});
    }
    return Localize.translateLocal('iou.updatedTheDistance', {
        newDistanceToDisplay: newDistance,
        oldDistanceToDisplay: oldDistance,
        newAmountToDisplay: newAmount,
        oldAmountToDisplay: oldAmount,
    });
}

/**
 * Get the report action message when expense has been modified.
 *
 * ModifiedExpense::getNewDotComment in Web-Expensify should match this.
 * If we change this function be sure to update the backend as well.
 */
function getModifiedExpenseMessage(reportAction: OnyxEntry<ReportAction>): string | undefined {
    const reportActionOriginalMessage = reportAction?.originalMessage as ExpanseOriginalMessage;
    if (Object.keys(reportActionOriginalMessage ?? {}).length === 0) {
        return Localize.translateLocal('iou.changedTheRequest');
    }

    const hasModifiedAmount =
        Object.hasOwn(reportActionOriginalMessage, 'oldAmount') &&
        Object.hasOwn(reportActionOriginalMessage, 'oldCurrency') &&
        Object.hasOwn(reportActionOriginalMessage, 'amount') &&
        Object.hasOwn(reportActionOriginalMessage, 'currency');

    const hasModifiedMerchant = Object.hasOwn(reportActionOriginalMessage, 'oldMerchant') && Object.hasOwn(reportActionOriginalMessage, 'merchant');
    if (hasModifiedAmount) {
        const oldCurrency = reportActionOriginalMessage?.oldCurrency;
        const oldAmount = CurrencyUtils.convertToDisplayString(reportActionOriginalMessage?.oldAmount ?? 0, oldCurrency ?? '');

        const currency = reportActionOriginalMessage?.currency;
        const amount = CurrencyUtils.convertToDisplayString(reportActionOriginalMessage?.amount ?? 0, currency);

        // Only Distance edits should modify amount and merchant (which stores distance) in a single transaction.
        // We check the merchant is in distance format (includes @) as a sanity check
        if (hasModifiedMerchant && reportActionOriginalMessage?.merchant?.includes('@')) {
            return getProperSchemaForModifiedDistanceMessage(reportActionOriginalMessage?.merchant, reportActionOriginalMessage?.oldMerchant ?? '', amount, oldAmount);
        }

        return getProperSchemaForModifiedExpenseMessage(amount, oldAmount, Localize.translateLocal('iou.amount'), false);
    }

    const hasModifiedComment = Object.hasOwn(reportActionOriginalMessage, 'oldComment') && Object.hasOwn(reportActionOriginalMessage, 'newComment');
    if (hasModifiedComment) {
        return getProperSchemaForModifiedExpenseMessage(
            reportActionOriginalMessage?.newComment ?? '',
            reportActionOriginalMessage?.oldComment ?? '',
            Localize.translateLocal('common.description'),
            true,
        );
    }

    const hasModifiedCreated = Object.hasOwn(reportActionOriginalMessage, 'oldCreated') && Object.hasOwn(reportActionOriginalMessage, 'created');
    if (hasModifiedCreated) {
        // Take only the YYYY-MM-DD value as the original date includes timestamp
        let formattedOldCreated: Date | string = new Date(reportActionOriginalMessage?.oldCreated ?? '');
        formattedOldCreated = format(formattedOldCreated, CONST.DATE.FNS_FORMAT_STRING);
        g;
        return getProperSchemaForModifiedExpenseMessage(reportActionOriginalMessage?.created ?? '', formattedOldCreated?.toString?.(), Localize.translateLocal('common.date'), false);
    }

    if (hasModifiedMerchant) {
        return getProperSchemaForModifiedExpenseMessage(
            reportActionOriginalMessage?.merchant ?? '',
            reportActionOriginalMessage?.oldMerchant ?? '',
            Localize.translateLocal('common.merchant'),
            true,
        );
    }

    const hasModifiedCategory = Object.hasOwn(reportActionOriginalMessage, 'oldCategory') && Object.hasOwn(reportActionOriginalMessage, 'category');
    if (hasModifiedCategory) {
        return getProperSchemaForModifiedExpenseMessage(
            reportActionOriginalMessage?.category ?? '',
            reportActionOriginalMessage?.oldCategory ?? '',
            Localize.translateLocal('common.category'),
            true,
        );
    }

    const hasModifiedTag = Object.hasOwn(reportActionOriginalMessage, 'oldTag') && Object.hasOwn(reportActionOriginalMessage, 'tag');
    if (hasModifiedTag) {
        return getProperSchemaForModifiedExpenseMessage(reportActionOriginalMessage?.tag ?? '', reportActionOriginalMessage?.oldTag ?? '', Localize.translateLocal('common.tag'), true);
    }

    const hasModifiedBillable = Object.hasOwn(reportActionOriginalMessage, 'oldBillable') && Object.hasOwn(reportActionOriginalMessage, 'billable');
    if (hasModifiedBillable) {
        return getProperSchemaForModifiedExpenseMessage(
            reportActionOriginalMessage?.billable ?? '',
            reportActionOriginalMessage?.oldBillable ?? '',
            Localize.translateLocal('iou.request'),
            true,
        );
    }
}

/**
 * Given the updates user made to the request, compose the originalMessage
 * object of the modified expense action.
 *
 * At the moment, we only allow changing one transaction field at a time.
 */
function getModifiedExpenseOriginalMessage(oldTransaction: OnyxEntry<Transaction>, transactionChanges: ExpanseOriginalMessage, isFromExpenseReport: boolean) {
    const originalMessage: ExpanseOriginalMessage = {};
    // Remark: Comment field is the only one which has new/old prefixes for the keys (newComment/ oldComment),
    // all others have old/- pattern such as oldCreated/created
    if (Object.hasOwn(transactionChanges, 'comment')) {
        originalMessage.oldComment = TransactionUtils.getDescription(oldTransaction);
        originalMessage.newComment = transactionChanges?.comment;
    }
    if (Object.hasOwn(transactionChanges, 'created')) {
        originalMessage.oldCreated = TransactionUtils.getCreated(oldTransaction);
        originalMessage.created = transactionChanges?.created;
    }
    if (Object.hasOwn(transactionChanges, 'merchant')) {
        originalMessage.oldMerchant = TransactionUtils.getMerchant(oldTransaction);
        originalMessage.merchant = transactionChanges?.merchant;
    }

    // The amount is always a combination of the currency and the number value so when one changes we need to store both
    // to match how we handle the modified expense action in oldDot
    if (Object.hasOwn(transactionChanges, 'amount') || Object.hasOwn(transactionChanges, 'currency')) {
        originalMessage.oldAmount = TransactionUtils.getAmount(oldTransaction, isFromExpenseReport);
        originalMessage.amount = transactionChanges?.amount;
        originalMessage.oldCurrency = TransactionUtils.getCurrency(oldTransaction);
        originalMessage.currency = transactionChanges?.currency;
    }

    if (Object.hasOwn(transactionChanges, 'category')) {
        originalMessage.oldCategory = TransactionUtils.getCategory(oldTransaction);
        originalMessage.category = transactionChanges?.category;
    }

    if (Object.hasOwn(transactionChanges, 'tag')) {
        originalMessage.oldTag = TransactionUtils.getTag(oldTransaction);
        originalMessage.tag = transactionChanges?.tag;
    }

    if (Object.hasOwn(transactionChanges, 'billable')) {
        const oldBillable = TransactionUtils.getBillable(oldTransaction);
        originalMessage.oldBillable = oldBillable ? Localize.translateLocal('common.billable').toLowerCase() : Localize.translateLocal('common.nonBillable').toLowerCase();
        originalMessage.billable = transactionChanges?.billable ? Localize.translateLocal('common.billable').toLowerCase() : Localize.translateLocal('common.nonBillable').toLowerCase();
    }

    return originalMessage;
}

/**
 * Returns the parentReport if the given report is a thread.
 */
function getParentReport(report: OnyxEntry<Report> | undefined): OnyxEntry<Report> | undefined | Record<string, never> {
    if (!report?.parentReportID) {
        return {};
    }
    return allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report.parentReportID}`];
}

/**
 * Returns the root parentReport if the given report is nested.
 * Uses recursion to iterate any depth of nested reports.
 */
function getRootParentReport(report?: OnyxEntry<Report>): OnyxEntry<Report> | Record<string, never> {
    if (!report) {
        return {};
    }

    // Returns the current report as the root report, because it does not have a parentReportID
    if (!report?.parentReportID) {
        return report;
    }

    const parentReport = getReport(report?.parentReportID);

    // Runs recursion to iterate a parent report
    return getRootParentReport(parentReport);
}

/**
 * Get the title for a report.
 */
function getReportName(report: OnyxEntry<Report>, policy: OnyxEntry<Policy> | undefined = undefined): string {
    let formattedName;
    const parentReportAction = ReportActionsUtils.getParentReportAction(report);
    if (!isTypeReportAction(parentReportAction)) {
        return '';
    }
    if (isChatThread(report)) {
        if (ReportActionsUtils.isTransactionThread(parentReportAction)) {
            return getTransactionReportName(parentReportAction);
        }

        const isAttachment = ReportActionsUtils.isReportActionAttachment(parentReportAction);
        const parentReportActionMessage = (parentReportAction?.message?.[0].text ?? '').replace(/(\r\n|\n|\r)/gm, ' ');
        if (isAttachment && parentReportActionMessage) {
            return `[${Localize.translateLocal('common.attachment')}]`;
        }
        if (
            parentReportAction?.message?.[0]?.moderationDecision?.decision === CONST.MODERATION.MODERATOR_DECISION_PENDING_HIDE ||
            parentReportAction?.message?.[0]?.moderationDecision?.decision === CONST.MODERATION.MODERATOR_DECISION_HIDDEN
        ) {
            return Localize.translateLocal('parentReportAction.hiddenMessage');
        }
        return parentReportActionMessage || Localize.translateLocal('parentReportAction.deletedMessage');
    }

    if (isTaskReport(report) && isCanceledTaskReport(report, parentReportAction)) {
        return Localize.translateLocal('parentReportAction.deletedTask');
    }

    if (isChatRoom(report) || isTaskReport(report)) {
        formattedName = report?.reportName;
    }

    if (isPolicyExpenseChat(report)) {
        formattedName = getPolicyExpenseChatName(report, policy);
    }

    if (isMoneyRequestReport(report)) {
        formattedName = getMoneyRequestReportName(report, policy);
    }

    if (isArchivedRoom(report)) {
        formattedName += ` (${Localize.translateLocal('common.archived')})`;
    }

    if (formattedName) {
        return formattedName;
    }

    // Not a room or PolicyExpenseChat, generate title from participants
    const participantAccountIDs = report?.participantAccountIDs ?? [];
    const participantsWithoutCurrentUser = participantAccountIDs.filter((accountID) => accountID !== currentUserAccountID);
    const isMultipleParticipantReport = participantsWithoutCurrentUser.length > 1;

    return participantsWithoutCurrentUser.map((accountID) => getDisplayNameForParticipant(accountID, isMultipleParticipantReport)).join(', ');
}

/**
 * Recursively navigates through thread parents to get the root report and workspace name.
 * The recursion stops when we find a non thread or money request report, whichever comes first.
 */
function getRootReportAndWorkspaceName(report?: OnyxEntry<Report>) {
    if (!report) {
        return {
            rootReportName: '',
            workspaceName: '',
        };
    }
    if (isChildReport(report) && !isMoneyRequestReport(report) && !isTaskReport(report)) {
        const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`];
        return getRootReportAndWorkspaceName(parentReport);
    }

    if (isIOURequest(report)) {
        return {
            rootReportName: getReportName(report),
        };
    }
    if (isExpenseRequest(report)) {
        return {
            rootReportName: getReportName(report),
            workspaceName: isIOUReport(report) ? CONST.POLICY.OWNER_EMAIL_FAKE : getPolicyName(report, true),
        };
    }

    return {
        rootReportName: getReportName(report),
        workspaceName: getPolicyName(report, true),
    };
}

/**
 * Get either the policyName or domainName the chat is tied to
 */
function getChatRoomSubtitle(report: OnyxEntry<Report>): string | undefined {
    if (isChatThread(report)) {
        return '';
    }
    if (!isDefaultRoom(report) && !isUserCreatedPolicyRoom(report) && !isPolicyExpenseChat(report)) {
        return '';
    }
    if (getChatType(report) === CONST.REPORT.CHAT_TYPE.DOMAIN_ALL) {
        // The domainAll rooms are just #domainName, so we ignore the prefix '#' to get the domainName
        return report?.reportName?.substring(1) ?? '';
    }
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if ((isPolicyExpenseChat(report) && report?.isOwnPolicyExpenseChat) || isExpenseReport(report)) {
        return Localize.translateLocal('workspace.common.workspace');
    }
    if (isArchivedRoom(report)) {
        return report?.oldPolicyName ?? '';
    }
    return getPolicyName(report);
}

/**
 * Gets the parent navigation subtitle for the report
 */
function getParentNavigationSubtitle(report: OnyxEntry<Report>) {
    if (isThread(report)) {
        const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`];
        const {rootReportName, workspaceName} = getRootReportAndWorkspaceName(parentReport);
        if (!rootReportName) {
            return {};
        }

        return {rootReportName, workspaceName};
    }
    return {};
}

/**
 * Navigate to the details page of a given report
 *
 */
function navigateToDetailsPage(report: OnyxEntry<Report>) {
    const participantAccountIDs = report?.participantAccountIDs ?? [];

    if (isDM(report) && participantAccountIDs.length === 1) {
        Navigation.navigate(ROUTES.PROFILE.getRoute(participantAccountIDs[0]));
        return;
    }
    Navigation.navigate(ROUTES.REPORT_WITH_ID_DETAILS.getRoute(report?.reportID ?? ''));
}

/**
 * Generate a random reportID up to 53 bits aka 9,007,199,254,740,991 (Number.MAX_SAFE_INTEGER).
 * There were approximately 98,000,000 reports with sequential IDs generated before we started using this approach, those make up roughly one billionth of the space for these numbers,
 * so we live with the 1 in a billion chance of a collision with an older ID until we can switch to 64-bit IDs.
 *
 * In a test of 500M reports (28 years of reports at our current max rate) we got 20-40 collisions meaning that
 * this is more than random enough for our needs.
 */
function generateReportID() {
    return (Math.floor(Math.random() * 2 ** 21) * 2 ** 32 + Math.floor(Math.random() * 2 ** 32)).toString();
}

function hasReportNameError(report: OnyxEntry<Report>): boolean {
    return Object.keys(report?.errorFields?.reportName ?? {}).length !== 0;
}

/**
 * For comments shorter than or equal to 10k chars, convert the comment from MD into HTML because that's how it is stored in the database
 * For longer comments, skip parsing, but still escape the text, and display plaintext for performance reasons. It takes over 40s to parse a 100k long string!!
 */
function getParsedComment(text: string): string {
    const parser = new ExpensiMark();
    return text.length <= CONST.MAX_MARKUP_LENGTH ? parser.replace(text) : lodashEscape(text);
}

type OptimisticReportAction = {
    commentText: string;
    reportAction: Partial<ReportAction>;
};
function buildOptimisticAddCommentReportAction(text?: string, file?: File & {source: string; uri: string}): OptimisticReportAction {
    const parser = new ExpensiMark();
    const commentText = getParsedComment(text ?? '');
    const isAttachment = !text && file !== undefined;
    const attachmentInfo = isAttachment ? file : {};
    const htmlForNewComment = isAttachment ? CONST.ATTACHMENT_UPLOADING_MESSAGE_HTML : commentText;

    // Remove HTML from text when applying optimistic offline comment
    const textForNewComment = isAttachment ? CONST.ATTACHMENT_MESSAGE_TEXT : parser.htmlToText(htmlForNewComment);
    return {
        commentText,
        reportAction: {
            reportActionID: NumberUtils.rand64(),
            actionName: CONST.REPORT.ACTIONS.TYPE.ADDCOMMENT,
            actorAccountID: currentUserAccountID,
            person: [
                {
                    style: 'strong',
                    text: allPersonalDetails?.[currentUserAccountID ?? -1]?.displayName ?? currentUserEmail,
                    type: 'TEXT',
                },
            ],
            automatic: false,
            avatar: allPersonalDetails?.[currentUserAccountID ?? -1]?.avatar ?? UserUtils.getDefaultAvatarURL(currentUserAccountID),
            created: DateUtils.getDBTime(),
            message: [
                {
                    translationKey: isAttachment ? CONST.TRANSLATION_KEYS.ATTACHMENT : '',
                    type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                    html: htmlForNewComment,
                    text: textForNewComment,
                },
            ],
            isFirstItem: false,
            isAttachment,
            attachmentInfo,
            pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
            shouldShow: true,
        },
    };
}

/**
 * update optimistic parent reportAction when a comment is added or remove in the child report
 * @param  parentReportAction - Parent report action of the child report
 * @param  lastVisibleActionCreated - Last visible action created of the child report
 * @param  type - The type of action in the child report
 */
type UpdateOptimisticParentReportAction = {
    childVisibleActionCount: number;
    childCommenterCount: number;
    childLastVisibleActionCreated: string;
    childOldestFourAccountIDs: string | undefined;
};
function updateOptimisticParentReportAction(parentReportAction: OnyxEntry<ReportAction>, lastVisibleActionCreated: string, type: string): UpdateOptimisticParentReportAction {
    let childVisibleActionCount = parentReportAction?.childVisibleActionCount ?? 0;
    let childCommenterCount = parentReportAction?.childCommenterCount ?? 0;
    let childOldestFourAccountIDs = parentReportAction?.childOldestFourAccountIDs;

    if (type === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
        childVisibleActionCount += 1;
        const oldestFourAccountIDs = childOldestFourAccountIDs ? childOldestFourAccountIDs.split(',') : [];
        if (oldestFourAccountIDs.length < 4) {
            const index = oldestFourAccountIDs.findIndex((accountID) => accountID === currentUserAccountID?.toString());
            if (index === -1) {
                childCommenterCount += 1;
                oldestFourAccountIDs.push(currentUserAccountID?.toString() ?? '');
            }
        }
        childOldestFourAccountIDs = oldestFourAccountIDs.join(',');
    } else if (type === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE) {
        if (childVisibleActionCount > 0) {
            childVisibleActionCount -= 1;
        }

        if (childVisibleActionCount === 0) {
            childCommenterCount = 0;
            childOldestFourAccountIDs = '';
        }
    }

    return {
        childVisibleActionCount,
        childCommenterCount,
        childLastVisibleActionCreated: lastVisibleActionCreated,
        childOldestFourAccountIDs,
    };
}

/**
 * Get optimistic data of parent report action
 * @param  reportID The reportID of the report that is updated
 * @param  lastVisibleActionCreated Last visible action created of the child report
 * @param  type The type of action in the child report
 * @param  parentReportID Custom reportID to be updated
 * @param  parentReportActionID Custom reportActionID to be updated
 */
function getOptimisticDataForParentReportAction(
    reportID: string,
    lastVisibleActionCreated: string,
    type: string,
    parentReportID = '',
    parentReportActionID = '',
): OnyxUpdate | Record<string, never> {
    const report = getReport(reportID);
    if (!report) {
        return {};
    }
    const parentReportAction = ReportActionsUtils.getParentReportAction(report);
    if (!parentReportAction || !isTypeReportAction(parentReportAction)) {
        return {};
    }

    const optimisticParentReportAction = updateOptimisticParentReportAction(parentReportAction, lastVisibleActionCreated, type);
    return {
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${parentReportID || report?.parentReportID}`,
        value: {
            [parentReportActionID || (report?.parentReportActionID ?? '')]: optimisticParentReportAction,
        },
    };
}

/**
 * Builds an optimistic reportAction for the parent report when a task is created
 * @param  taskReportID - Report ID of the task
 * @param  taskTitle - Title of the task
 * @param  taskAssignee - Email of the person assigned to the task
 * @param  taskAssigneeAccountID - AccountID of the person assigned to the task
 * @param  text - Text of the comment
 * @param  parentReportID - Report ID of the parent report
 */
function buildOptimisticTaskCommentReportAction(taskReportID: string, taskTitle: string, taskAssignee: string, taskAssigneeAccountID: number, text: string, parentReportID: string) {
    const reportAction = buildOptimisticAddCommentReportAction(text);
    if (reportAction.reportAction.message) {
        reportAction.reportAction.message[0].taskReportID = taskReportID;
    }

    // These parameters are not saved on the reportAction, but are used to display the task in the UI
    // Added when we fetch the reportActions on a report
    reportAction.reportAction.originalMessage = {
        html: reportAction.reportAction.message?.[0].html,
        taskReportID: reportAction.reportAction.message?.[0].taskReportID,
    };
    reportAction.reportAction.childReportID = taskReportID;
    reportAction.reportAction.parentReportID = parentReportID;
    reportAction.reportAction.childType = CONST.REPORT.TYPE.TASK;
    reportAction.reportAction.childReportName = taskTitle;
    reportAction.reportAction.childManagerAccountID = taskAssigneeAccountID;
    reportAction.reportAction.childStatusNum = CONST.REPORT.STATUS.OPEN;
    reportAction.reportAction.childStateNum = CONST.REPORT.STATE_NUM.OPEN;

    return reportAction;
}

/**
 * Builds an optimistic IOU report with a randomly generated reportID
 *
 * @param  payeeAccountID - AccountID of the person generating the IOU.
 * @param  payerAccountID - AccountID of the other person participating in the IOU.
 * @param  total - IOU amount in the smallest unit of the currency.
 * @param  chatReportID - Report ID of the chat where the IOU is.
 * @param  currency - IOU currency.
 * @param  isSendingMoney - If we send money the IOU should be created as settled
 */

type OptimisticIOUReport = Pick<
    Report,
    | 'cachedTotal'
    | 'hasOutstandingIOU'
    | 'type'
    | 'chatReportID'
    | 'currency'
    | 'managerID'
    | 'ownerAccountID'
    | 'participantAccountIDs'
    | 'reportID'
    | 'state'
    | 'stateNum'
    | 'total'
    | 'reportName'
    | 'notificationPreference'
    | 'parentReportID'
    | 'statusNum'
>;
function buildOptimisticIOUReport(payeeAccountID: number, payerAccountID: number, total: number, chatReportID: string, currency: string, isSendingMoney = false): OptimisticIOUReport {
    const formattedTotal = CurrencyUtils.convertToDisplayString(total, currency);
    const personalDetails = getPersonalDetailsForAccountID(payerAccountID);
    const payerEmail = 'login' in personalDetails ? personalDetails.login : '';
    return {
        // If we're sending money, hasOutstandingIOU should be false
        hasOutstandingIOU: !isSendingMoney,
        type: CONST.REPORT.TYPE.IOU,
        cachedTotal: formattedTotal,
        chatReportID,
        currency,
        managerID: payerAccountID,
        ownerAccountID: payeeAccountID,
        participantAccountIDs: [payeeAccountID, payerAccountID],
        reportID: generateReportID(),
        state: CONST.REPORT.STATE.SUBMITTED,
        stateNum: isSendingMoney ? CONST.REPORT.STATE_NUM.SUBMITTED : CONST.REPORT.STATE_NUM.PROCESSING,
        statusNum: isSendingMoney ? CONST.REPORT.STATUS.REIMBURSED : CONST.REPORT.STATE_NUM.PROCESSING,
        total,

        // We don't translate reportName because the server response is always in English
        reportName: `${payerEmail} owes ${formattedTotal}`,
        notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS,
        parentReportID: chatReportID,
    };
}

/**
 * Builds an optimistic Expense report with a randomly generated reportID
 *
 * @param  chatReportID - Report ID of the PolicyExpenseChat where the Expense Report is
 * @param  policyID - The policy ID of the PolicyExpenseChat
 * @param  payeeAccountID - AccountID of the employee (payee)
 * @param  total - Amount in cents
 * @param  currency
 */

type OptimisticExpanseReport = Pick<
    Report,
    | 'reportID'
    | 'chatReportID'
    | 'policyID'
    | 'type'
    | 'ownerAccountID'
    | 'hasOutstandingIOU'
    | 'currency'
    | 'reportName'
    | 'state'
    | 'stateNum'
    | 'total'
    | 'notificationPreference'
    | 'parentReportID'
>;
function buildOptimisticExpenseReport(chatReportID: string, policyID: string, payeeAccountID: number, total: number, currency: string): OptimisticExpanseReport {
    // The amount for Expense reports are stored as negative value in the database
    const storedTotal = total * -1;
    const policyName = getPolicyName(allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${chatReportID}`]);
    const formattedTotal = CurrencyUtils.convertToDisplayString(storedTotal, currency);

    // The expense report is always created with the policy's output currency
    const outputCurrency = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`]?.outputCurrency ?? CONST.CURRENCY.USD;

    return {
        reportID: generateReportID(),
        chatReportID,
        policyID,
        type: CONST.REPORT.TYPE.EXPENSE,
        ownerAccountID: payeeAccountID,
        hasOutstandingIOU: true,
        currency: outputCurrency,

        // We don't translate reportName because the server response is always in English
        reportName: `${policyName} owes ${formattedTotal}`,
        state: CONST.REPORT.STATE.SUBMITTED,
        stateNum: CONST.REPORT.STATE_NUM.PROCESSING,
        total: storedTotal,
        notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS,
        parentReportID: chatReportID,
    };
}

/**
 * @param  iouReportID - the report ID of the IOU report the action belongs to
 * @param  type - IOUReportAction type. Can be oneOf(create, decline, cancel, pay, split)
 * @param  total - IOU total in cents
 * @param  comment - IOU comment
 * @param  currency - IOU currency
 * @param  paymentType - IOU paymentMethodType. Can be oneOf(Elsewhere, Expensify)
 * @param  isSettlingUp - Whether we are settling up an IOU
 */
function getIOUReportActionMessage(iouReportID: string, type: string, total: number, comment: string, currency: string, paymentType = '', isSettlingUp = false): [Message] {
    const report = getReport(iouReportID);
    const amount =
        type === CONST.IOU.REPORT_ACTION_TYPE.PAY
            ? CurrencyUtils.convertToDisplayString(getMoneyRequestReimbursableTotal(report), currency)
            : CurrencyUtils.convertToDisplayString(total, currency);

    let paymentMethodMessage;
    switch (paymentType) {
        case CONST.IOU.PAYMENT_TYPE.VBBA:
        case CONST.IOU.PAYMENT_TYPE.EXPENSIFY:
            paymentMethodMessage = ' with Expensify';
            break;
        default:
            paymentMethodMessage = ` elsewhere`;
            break;
    }

    let iouMessage;
    switch (type) {
        case CONST.REPORT.ACTIONS.TYPE.APPROVED:
            iouMessage = `approved ${amount}`;
            break;
        case CONST.REPORT.ACTIONS.TYPE.SUBMITTED:
            iouMessage = `submitted ${amount}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.CREATE:
            iouMessage = `requested ${amount}${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.SPLIT:
            iouMessage = `split ${amount}${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.DELETE:
            iouMessage = `deleted the ${amount} request${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.PAY:
            iouMessage = isSettlingUp ? `paid ${amount}${paymentMethodMessage}` : `sent ${amount}${comment && ` for ${comment}`}${paymentMethodMessage}`;
            break;
        default:
            break;
    }

    return [
        {
            html: lodashEscape(iouMessage),
            text: iouMessage ?? '',
            isEdited: false,
            type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
        },
    ];
}

/**
 * Builds an optimistic IOU reportAction object
 *
 * @param  type - IOUReportAction type. Can be oneOf(create, delete, pay, split).
 * @param  amount - IOU amount in cents.
 * @param  currency
 * @param  comment - User comment for the IOU.
 * @param  participants - An array with participants details.
 * @param  [transactionID] - Not required if the IOUReportAction type is 'pay'
 * @param  [paymentType] - Only required if the IOUReportAction type is 'pay'. Can be oneOf(elsewhere, Expensify).
 * @param  [iouReportID] - Only required if the IOUReportActions type is oneOf(decline, cancel, pay). Generates a randomID as default.
 * @param  [isSettlingUp] - Whether we are settling up an IOU.
 * @param  [isSendMoneyFlow] - Whether this is send money flow
 * @param  [receipt]
 * @param  [isOwnPolicyExpenseChat] - Whether this is an expense report create from the current user's policy expense chat
 */

type OptimisticIOUReportAction = Pick<
    ReportAction,
    | 'actionName'
    | 'actorAccountID'
    | 'automatic'
    | 'avatar'
    | 'isAttachment'
    | 'originalMessage'
    | 'message'
    | 'person'
    | 'reportActionID'
    | 'shouldShow'
    | 'created'
    | 'pendingAction'
    | 'receipt'
    | 'whisperedToAccountIDs'
>;
function buildOptimisticIOUReportAction(
    type: ValueOf<typeof CONST.IOU.REPORT_ACTION_TYPE>,
    amount: number,
    currency: string,
    comment: string,
    participants: Participant[],
    transactionID: string,
    paymentType: DeepValueOf<typeof CONST.IOU.PAYMENT_TYPE>,
    iouReportID = '',
    isSettlingUp = false,
    isSendMoneyFlow = false,
    receipt: Receipt = {},
    isOwnPolicyExpenseChat = false,
): OptimisticIOUReportAction {
    const IOUReportID = iouReportID || generateReportID();

    const originalMessage: IOUMessage = {
        amount,
        comment,
        currency,
        IOUTransactionID: transactionID,
        IOUReportID: Number(IOUReportID),
        type,
    };

    if (type === CONST.IOU.REPORT_ACTION_TYPE.PAY) {
        // In send money flow, we store amount, comment, currency in IOUDetails when type = pay
        if (isSendMoneyFlow) {
            const keys = ['amount', 'comment', 'currency'] as const;
            keys.forEach((key) => {
                delete originalMessage[key];
            });
            originalMessage.IOUDetails = {amount, comment, currency};
            originalMessage.paymentType = paymentType;
        } else {
            // In case of pay money request action, we dont store the comment
            // and there is no single transctionID to link the action to.
            delete originalMessage.IOUTransactionID;
            delete originalMessage.comment;
            originalMessage.paymentType = paymentType;
        }
    }

    // IOUs of type split only exist in group DMs and those don't have an iouReport so we need to delete the IOUReportID key
    if (type === CONST.IOU.REPORT_ACTION_TYPE.SPLIT) {
        delete originalMessage.IOUReportID;
        // Split bill made from a policy expense chat only have the payee's accountID as the participant because the payer could be any policy admin
        if (isOwnPolicyExpenseChat) {
            originalMessage.participantAccountIDs = [currentUserAccountID ?? -1];
        } else {
            originalMessage.participantAccountIDs = [currentUserAccountID ?? -1, ...participants.map((participant) => participant.accountID)];
        }
    }

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: currentUserPersonalDetails?.avatar ?? UserUtils.getDefaultAvatar(currentUserAccountID),
        isAttachment: false,
        originalMessage,
        message: getIOUReportActionMessage(iouReportID, type, amount, comment, currency, paymentType, isSettlingUp),
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? currentUserEmail,
                type: 'TEXT',
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        whisperedToAccountIDs: [CONST.IOU.RECEIPT_STATE.SCANREADY, CONST.IOU.RECEIPT_STATE.SCANNING].some((value) => value === receipt?.state) ? [currentUserAccountID] : [],
    };
}
/**
 * Builds an optimistic APPROVED report action with a randomly generated reportActionID.
 */
function buildOptimisticApprovedReportAction(
    amount: number,
    currency: string,
    expenseReportID: string,
): Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'automatic' | 'avatar' | 'isAttachment' | 'originalMessage' | 'message' | 'person' | 'reportActionID' | 'shouldShow' | 'created' | 'pendingAction'
> {
    const originalMessage = {
        amount,
        currency,
        expenseReportID,
    };

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.APPROVED,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: currentUserPersonalDetails?.avatar ?? UserUtils.getDefaultAvatar(currentUserAccountID),
        isAttachment: false,
        originalMessage,
        message: getIOUReportActionMessage(expenseReportID, CONST.REPORT.ACTIONS.TYPE.APPROVED, Math.abs(amount), '', currency),
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? currentUserEmail,
                type: 'TEXT',
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic SUBMITTED report action with a randomly generated reportActionID.
 *
 */
function buildOptimisticSubmittedReportAction(amount: number, currency: string, expenseReportID: string) {
    const originalMessage = {
        amount,
        currency,
        expenseReportID,
    };

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.SUBMITTED,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: currentUserPersonalDetails?.avatar ?? UserUtils.getDefaultAvatar(currentUserAccountID),
        isAttachment: false,
        originalMessage,
        message: getIOUReportActionMessage(expenseReportID, CONST.REPORT.ACTIONS.TYPE.SUBMITTED, Math.abs(amount), '', currency),
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? currentUserEmail,
                type: 'TEXT',
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

type OptimisticReportPreviw = Pick<
    ReportAction,
    | 'actionName'
    | 'reportActionID'
    | 'pendingAction'
    | 'originalMessage'
    | 'message'
    | 'created'
    | 'actorAccountID'
    | 'childMoneyRequestCount'
    | 'childLastMoneyRequestComment'
    | 'childRecentReceiptTransactionIDs'
    | 'whisperedToAccountIDs'
> & {reportID?: string; accountID?: number};
/**
 * Builds an optimistic report preview action with a randomly generated reportActionID.
 *
 * @param  chatReport
 * @param  iouReport
 * @param  [comment] - User comment for the IOU.
 * @param  [transaction] - optimistic first transaction of preview
 */
function buildOptimisticReportPreview(chatReport: OnyxEntry<Report>, iouReport: OnyxEntry<Report>, comment = '', transaction: Transaction | undefined = undefined): OptimisticReportPreviw {
    const hasReceipt = TransactionUtils.hasReceipt(transaction);
    const isReceiptBeingScanned = hasReceipt && transaction && TransactionUtils.isReceiptBeingScanned(transaction);
    const message = getReportPreviewMessage(iouReport);
    const created = DateUtils.getDBTime();
    return {
        reportActionID: NumberUtils.rand64(),
        reportID: chatReport?.reportID,
        actionName: CONST.REPORT.ACTIONS.TYPE.REPORTPREVIEW,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        originalMessage: {
            linkedReportID: iouReport?.reportID,
        },
        message: [
            {
                html: message,
                text: message,
                isEdited: false,
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
            },
        ],
        created,
        accountID: iouReport?.managerID ?? 0,
        // The preview is initially whispered if created with a receipt, so the actor is the current user as well
        actorAccountID: hasReceipt ? currentUserAccountID : iouReport?.managerID ?? 0,
        childMoneyRequestCount: 1,
        childLastMoneyRequestComment: comment,
        childRecentReceiptTransactionIDs: hasReceipt && transaction ? {[transaction.transactionID]: created} : undefined,
        whisperedToAccountIDs: isReceiptBeingScanned ? [currentUserAccountID] : [],
    };
}

/**
 * Builds an optimistic modified expense action with a randomly generated reportActionID.
 */
function buildOptimisticModifiedExpenseReportAction(
    transactionThread: OnyxEntry<Transaction>,
    oldTransaction: OnyxEntry<Transaction>,
    transactionChanges: ExpanseOriginalMessage,
    isFromExpenseReport: boolean,
) {
    const originalMessage = getModifiedExpenseOriginalMessage(oldTransaction, transactionChanges, isFromExpenseReport);
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.MODIFIEDEXPENSE,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: currentUserPersonalDetails?.avatar ?? UserUtils.getDefaultAvatar(currentUserAccountID),
        created: DateUtils.getDBTime(),
        isAttachment: false,
        message: [
            {
                // Currently we are composing the message from the originalMessage and message is only used in OldDot and not in the App
                text: 'You',
                style: 'strong',
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
        ],
        originalMessage,
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? currentUserAccountID,
                type: 'TEXT',
            },
        ],
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        reportActionID: NumberUtils.rand64(),
        reportID: transactionThread?.reportID,
        shouldShow: true,
    };
}
type UpdateReportPreview = Pick<
    ReportAction,
    'created' | 'message' | 'childLastMoneyRequestComment' | 'childMoneyRequestCount' | 'childRecentReceiptTransactionIDs' | 'whisperedToAccountIDs'
>;
/**
 * Updates a report preview action that exists for an IOU report.
 *
 * @param  iouReport
 * @param reportPreviewAction
 * @param  [isPayRequest]
 * @param  [comment] - User comment for the IOU.
 * @param  [transaction] - optimistic newest transaction of a report preview
 *
 */
function updateReportPreview(
    iouReport: OnyxEntry<Report>,
    reportPreviewAction: OnyxEntry<ReportAction>,
    isPayRequest = false,
    comment = '',
    transaction: OnyxEntry<Transaction> | undefined = undefined,
): UpdateReportPreview {
    const hasReceipt = TransactionUtils.hasReceipt(transaction);
    const recentReceiptTransactions = reportPreviewAction?.childRecentReceiptTransactionIDs ?? {};
    const transactionsToKeep = TransactionUtils.getRecentTransactions(recentReceiptTransactions);
    const previousTransactionsArray = Object.entries(recentReceiptTransactions ?? {}).map((item) => {
        const [key, value] = item;
        return transactionsToKeep.includes(key) ? {[key]: value} : null;
    });
    const previousTransactions: Record<string, string> = {};

    for (const obj of previousTransactionsArray) {
        for (const key in obj) {
            if (Object.hasOwn(obj, key)) {
                previousTransactions[key] = obj[key];
            }
        }
    }

    const message = getReportPreviewMessage(iouReport, reportPreviewAction);
    return {
        ...reportPreviewAction,
        created: DateUtils.getDBTime(),
        message: [
            {
                html: message,
                text: message,
                isEdited: false,
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
            },
        ],
        childLastMoneyRequestComment: comment || reportPreviewAction?.childLastMoneyRequestComment,
        childMoneyRequestCount: (reportPreviewAction?.childMoneyRequestCount ?? 0) + (isPayRequest ? 0 : 1),
        childRecentReceiptTransactionIDs: hasReceipt
            ? {
                  ...(transaction && {[transaction.transactionID]: transaction?.created}),
                  ...previousTransactions,
              }
            : recentReceiptTransactions,
        // As soon as we add a transaction without a receipt to the report, it will have ready money requests,
        // so we remove the whisper
        whisperedToAccountIDs: hasReceipt ? reportPreviewAction?.whisperedToAccountIDs : [],
    };
}

function buildOptimisticTaskReportAction(taskReportID: string, actionName: DeepValueOf<typeof CONST.REPORT.ACTIONS.TYPE>, message = '') {
    const originalMessage = {
        taskReportID,
        type: actionName,
        text: message,
    };

    return {
        actionName,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: currentUserPersonalDetails?.avatar ?? UserUtils.getDefaultAvatar(currentUserAccountID),
        isAttachment: false,
        originalMessage,
        message: [
            {
                text: message,
                taskReportID,
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
        ],
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? currentUserAccountID,
                type: 'TEXT',
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        isFirstItem: false,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic chat report with a randomly generated reportID and as much information as we currently have
 */
function buildOptimisticChatReport(
    participantList: Array<number | undefined>,
    reportName: string = CONST.REPORT.DEFAULT_REPORT_NAME,
    chatType: ValueOf<typeof CONST.REPORT.CHAT_TYPE> | '' = '',
    policyID: string = CONST.POLICY.OWNER_EMAIL_FAKE,
    ownerAccountID: number = CONST.REPORT.OWNER_ACCOUNT_ID_FAKE,
    isOwnPolicyExpenseChat = false,
    oldPolicyName = '',
    visibility: ValueOf<typeof CONST.REPORT.VISIBILITY> | undefined | null = undefined,
    writeCapability: ValueOf<typeof CONST.REPORT.WRITE_CAPABILITIES> | undefined = undefined,
    notificationPreference: string | number = CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS,
    parentReportActionID = '',
    parentReportID = '',
    welcomeMessage = '',
) {
    const currentTime = DateUtils.getDBTime();
    return {
        type: CONST.REPORT.TYPE.CHAT,
        chatType,
        hasOutstandingIOU: false,
        isOwnPolicyExpenseChat,
        isPinned: reportName === CONST.REPORT.WORKSPACE_CHAT_ROOMS.ADMINS,
        lastActorAccountID: 0,
        lastMessageTranslationKey: '',
        lastMessageHtml: '',
        lastMessageText: null,
        lastReadTime: currentTime,
        lastVisibleActionCreated: currentTime,
        notificationPreference,
        oldPolicyName,
        ownerAccountID: ownerAccountID || CONST.REPORT.OWNER_ACCOUNT_ID_FAKE,
        parentReportActionID,
        parentReportID,
        participantAccountIDs: participantList,
        policyID,
        reportID: generateReportID(),
        reportName,
        stateNum: 0,
        statusNum: 0,
        visibility,
        welcomeMessage,
        writeCapability,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that the chat has been created optimistically
 */
function buildOptimisticCreatedReportAction(emailCreatingAction: string) {
    return {
        reportActionID: NumberUtils.rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.CREATED,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: emailCreatingAction,
            },
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: ' created this report',
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: allPersonalDetails?.[currentUserAccountID ?? '']?.displayName ?? currentUserEmail,
            },
        ],
        automatic: false,
        avatar: allPersonalDetails?.[currentUserAccountID ?? '']?.avatar ?? UserUtils.getDefaultAvatar(currentUserAccountID),
        created: DateUtils.getDBTime(),
        shouldShow: true,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that a task report has been edited
 */
function buildOptimisticEditedTaskReportAction(emailEditingTask: string) {
    // TODO: create type for return value
    return {
        reportActionID: NumberUtils.rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.TASKEDITED,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: emailEditingTask,
            },
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: ' edited this task',
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: allPersonalDetails?.[currentUserAccountID ?? '']?.displayName ?? currentUserEmail,
            },
        ],
        automatic: false,
        avatar: allPersonalDetails?.[currentUserAccountID ?? '']?.avatar ?? UserUtils.getDefaultAvatar(currentUserAccountID),
        created: DateUtils.getDBTime(),
        shouldShow: false,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that a chat has been archived
 *
 * @param emailClosingReport
 * @param policyName
 * @param reason - A reason why the chat has been archived
 */
function buildOptimisticClosedReportAction(emailClosingReport: string, policyName: string, reason: string = CONST.REPORT.ARCHIVE_REASON.DEFAULT) {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.CLOSED,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: allPersonalDetails?.[currentUserAccountID ?? '']?.avatar ?? UserUtils.getDefaultAvatar(currentUserAccountID),
        created: DateUtils.getDBTime(),
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: emailClosingReport,
            },
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: ' closed this report',
            },
        ],
        originalMessage: {
            policyName,
            reason,
        },
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: allPersonalDetails?.[currentUserAccountID ?? '']?.displayName ?? currentUserEmail,
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
    };
}

function buildOptimisticWorkspaceChats(policyID: string, policyName: string) {
    const announceChatData = buildOptimisticChatReport(
        [currentUserAccountID ?? -1],
        CONST.REPORT.WORKSPACE_CHAT_ROOMS.ANNOUNCE,
        CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE,
        policyID,
        CONST.POLICY.OWNER_ACCOUNT_ID_FAKE,
        false,
        policyName,
        null,
        undefined,

        // #announce contains all policy members so notifying always should be opt-in only.
        CONST.REPORT.NOTIFICATION_PREFERENCE.DAILY,
    );
    const announceChatReportID = announceChatData.reportID;
    const announceCreatedAction = buildOptimisticCreatedReportAction(CONST.POLICY.OWNER_EMAIL_FAKE);
    const announceReportActionData = {
        [announceCreatedAction.reportActionID]: announceCreatedAction,
    };

    const adminsChatData = buildOptimisticChatReport(
        [currentUserAccountID ?? -1],
        CONST.REPORT.WORKSPACE_CHAT_ROOMS.ADMINS,
        CONST.REPORT.CHAT_TYPE.POLICY_ADMINS,
        policyID,
        CONST.POLICY.OWNER_ACCOUNT_ID_FAKE,
        false,
        policyName,
    );
    const adminsChatReportID = adminsChatData.reportID;
    const adminsCreatedAction = buildOptimisticCreatedReportAction(CONST.POLICY.OWNER_EMAIL_FAKE);
    const adminsReportActionData = {
        [adminsCreatedAction.reportActionID]: adminsCreatedAction,
    };

    const expenseChatData = buildOptimisticChatReport([currentUserAccountID ?? -1], '', CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT, policyID, currentUserAccountID, true, policyName);
    const expenseChatReportID = expenseChatData.reportID;
    const expenseReportCreatedAction = buildOptimisticCreatedReportAction(currentUserEmail ?? '');
    const expenseReportActionData = {
        [expenseReportCreatedAction.reportActionID]: expenseReportCreatedAction,
    };

    return {
        announceChatReportID,
        announceChatData,
        announceReportActionData,
        announceCreatedReportActionID: announceCreatedAction.reportActionID,
        adminsChatReportID,
        adminsChatData,
        adminsReportActionData,
        adminsCreatedReportActionID: adminsCreatedAction.reportActionID,
        expenseChatReportID,
        expenseChatData,
        expenseReportActionData,
        expenseCreatedReportActionID: expenseReportCreatedAction.reportActionID,
    };
}

/**
 * Builds an optimistic Task Report with a randomly generated reportID
 *
 * @param  ownerAccountID - Account ID of the person generating the Task.
 * @param  assigneeAccountID - AccountID of the other person participating in the Task.
 * @param  parentReportID - Report ID of the chat where the Task is.
 * @param  title - Task title.
 * @param  description - Task description.
 * @param  policyID - PolicyID of the parent report
 */

function buildOptimisticTaskReport(
    ownerAccountID: number,
    assigneeAccountID?: number,
    parentReportID?: string,
    title?: string,
    description?: string,
    policyID: string = CONST.POLICY.OWNER_EMAIL_FAKE,
) {
    return {
        reportID: generateReportID(),
        reportName: title,
        description,
        ownerAccountID,
        participantAccountIDs: assigneeAccountID && assigneeAccountID !== ownerAccountID ? [assigneeAccountID] : [],
        managerID: assigneeAccountID,
        type: CONST.REPORT.TYPE.TASK,
        parentReportID,
        policyID,
        stateNum: CONST.REPORT.STATE_NUM.OPEN,
        statusNum: CONST.REPORT.STATUS.OPEN,
        notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS,
    };
}

/**
 * A helper method to create transaction thread
 *
 * @param reportAction - the parent IOU report action from which to create the thread
 *
 * @param moneyRequestReportID - the reportID which the report action belong to
 */
function buildTransactionThread(reportAction: OnyxEntry<ReportAction>, moneyRequestReportID: string) {
    const participantAccountIDs = [...new Set([currentUserAccountID, Number(reportAction?.actorAccountID)])];
    return buildOptimisticChatReport(
        participantAccountIDs,
        getTransactionReportName(reportAction),
        '',
        getReport(moneyRequestReportID)?.policyID ?? CONST.POLICY.OWNER_EMAIL_FAKE,
        CONST.POLICY.OWNER_ACCOUNT_ID_FAKE,
        false,
        '',
        undefined,
        undefined,
        CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS,
        reportAction?.reportActionID,
        moneyRequestReportID,
    );
}

function isUnread(report: OnyxEntry<Report>): boolean {
    if (!report) {
        return false;
    }

    // lastVisibleActionCreated and lastReadTime are both datetime strings and can be compared directly
    const lastVisibleActionCreated = report.lastVisibleActionCreated ?? '';
    const lastReadTime = report.lastReadTime ?? '';
    return lastReadTime < lastVisibleActionCreated;
}

function isUnreadWithMention(report: OnyxEntry<Report>): boolean {
    if (!report) {
        return false;
    }
    // lastMentionedTime and lastReadTime are both datetime strings and can be compared directly
    const lastMentionedTime = report?.lastMentionedTime ?? '';
    const lastReadTime = report?.lastReadTime ?? '';
    return lastReadTime < lastMentionedTime;
}

function isIOUOwnedByCurrentUser(report: OnyxEntry<Report>, allReportsDict: OnyxCollection<Report> = null) {
    const allAvailableReports = allReportsDict ?? allReports;
    if (!report || !allAvailableReports) {
        return false;
    }

    let reportToLook = report;
    if (report.iouReportID) {
        const iouReport = allAvailableReports[`${ONYXKEYS.COLLECTION.REPORT}${report.iouReportID}`];
        if (iouReport) {
            reportToLook = iouReport;
        }
    }

    return reportToLook.ownerAccountID === currentUserAccountID;
}

/**
 * Should return true only for personal 1:1 report
 *
 * @param report (chatReport or iouReport)
 */

// @ts-expect-error Will be fixed when OptionUtils will be merged
function isOneOnOneChat(report): boolean {
    const isChatRoomValue = report?.isChatRoom ?? false;
    const participantsListValue = report?.participantsList ?? [];
    return (
        !isThread(report) &&
        !isChatRoom(report) &&
        !isChatRoomValue &&
        !isExpenseRequest(report) &&
        !isMoneyRequestReport(report) &&
        !isPolicyExpenseChat(report) &&
        !isTaskReport(report) &&
        isDM(report) &&
        !isIOUReport(report) &&
        participantsListValue.length === 1
    );
}

/**
 * Assuming the passed in report is a default room, lets us know whether we can see it or not, based on permissions and
 * the various subsets of users we've allowed to use default rooms.
 */
function canSeeDefaultRoom(report: OnyxEntry<Report>, policies: OnyxCollection<Policy>, betas: Beta[]): boolean {
    // Include archived rooms
    if (isArchivedRoom(report)) {
        return true;
    }

    // Include default rooms for free plan policies (domain rooms aren't included in here because they do not belong to a policy)
    if (getPolicyType(report, policies) === CONST.POLICY.TYPE.FREE) {
        return true;
    }

    // Include domain rooms with Partner Managers (Expensify accounts) in them for accounts that are on a domain with an Approved Accountant
    if (isDomainRoom(report) && doesDomainHaveApprovedAccountant && hasExpensifyEmails(report?.participantAccountIDs ?? [])) {
        return true;
    }

    // If the room has an assigned guide, it can be seen.
    if (hasExpensifyGuidesEmails(report?.participantAccountIDs ?? [])) {
        return true;
    }

    // Include any admins and announce rooms, since only non partner-managed domain rooms are on the beta now.
    if (isAdminRoom(report) || isAnnounceRoom(report)) {
        return true;
    }

    // For all other cases, just check that the user belongs to the default rooms beta
    return Permissions.canUseDefaultRooms(betas);
}

function canAccessReport(report: OnyxEntry<Report>, policies: OnyxCollection<Policy>, betas: Beta[], allReportActions?: OnyxCollection<ReportActions>): boolean {
    if (isThread(report) && ReportActionsUtils.isPendingRemove(ReportActionsUtils.getParentReportAction(report, allReportActions))) {
        return false;
    }

    // We hide default rooms (it's basically just domain rooms now) from people who aren't on the defaultRooms beta.
    if (isDefaultRoom(report) && !canSeeDefaultRoom(report, policies, betas)) {
        return false;
    }

    return true;
}
/**
 * Check if the report is the parent report of the currently viewed report or at least one child report has report action
 */
function shouldHideReport(report: OnyxEntry<Report>, currentReportId: string): boolean {
    const parentReport = getParentReport(getReport(currentReportId));
    const reportActions = ReportActionsUtils.getAllReportActions(report?.reportID ?? '');
    const isChildReportHasComment = Object.values(reportActions ?? {})?.some((reportAction) => (reportAction?.childVisibleActionCount ?? 0) > 0);
    return parentReport?.reportID !== report?.reportID && !isChildReportHasComment;
}

/**
 * Takes several pieces of data from Onyx and evaluates if a report should be shown in the option list (either when searching
 * for reports or the reports shown in the LHN).
 *
 * This logic is very specific and the order of the logic is very important. It should fail quickly in most cases and also
 * filter out the majority of reports before filtering out very specific minority of reports.
 */
function shouldReportBeInOptionList(
    // TODO: Change to OptionList type when merged
    report: OnyxEntry<Report>,
    currentReportId: string,
    isInGSDMode: boolean,
    betas: Beta[],
    policies: OnyxCollection<Policy>,
    allReportActions: OnyxCollection<ReportActions>,
    excludeEmptyChats = false,
) {
    const isInDefaultMode = !isInGSDMode;
    // Exclude reports that have no data because there wouldn't be anything to show in the option item.
    // This can happen if data is currently loading from the server or a report is in various stages of being created.
    // This can also happen for anyone accessing a public room or archived room for which they don't have access to the underlying policy.
    if (
        !report?.reportID ||
        !report.type ||
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        report.isHidden ||
        (report.participantAccountIDs &&
            report.participantAccountIDs.length === 0 &&
            !isChatThread(report) &&
            !isUserCreatedPolicyRoom(report) &&
            !isArchivedRoom(report) &&
            !isMoneyRequestReport(report) &&
            !isTaskReport(report))
    ) {
        return false;
    }

    if (!canAccessReport(report, policies, betas, allReportActions)) {
        return false;
    }

    // Include the currently viewed report. If we excluded the currently viewed report, then there
    // would be no way to highlight it in the options list and it would be confusing to users because they lose
    // a sense of context.
    if (report.reportID === currentReportId) {
        return true;
    }

    // Include reports that are relevant to the user in any view mode. Criteria include having a draft, having an outstanding IOU, or being assigned to an open task.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (report.hasDraft || isWaitingForIOUActionFromCurrentUser(report) || isWaitingForTaskCompleteFromAssignee(report)) {
        return true;
    }
    const lastVisibleMessage = ReportActionsUtils.getLastVisibleMessage(report.reportID);
    const isEmptyChat = !report.lastMessageText && !report.lastMessageTranslationKey && !lastVisibleMessage.lastMessageText && !lastVisibleMessage.lastMessageTranslationKey;
    const canHideReport = shouldHideReport(report, currentReportId);

    // Include reports if they are pinned
    if (report.isPinned) {
        return true;
    }

    // Include reports that have errors from trying to add a workspace
    // If we excluded it, then the red-brock-road pattern wouldn't work for the user to resolve the error
    if (report.errorFields?.addWorkspaceRoom) {
        return true;
    }

    // All unread chats (even archived ones) in GSD mode will be shown. This is because GSD mode is specifically for focusing the user on the most relevant chats, primarily, the unread ones
    if (isInGSDMode) {
        return isUnread(report);
    }

    // Archived reports should always be shown when in default (most recent) mode. This is because you should still be able to access and search for the chats to find them.
    if (isInDefaultMode && isArchivedRoom(report)) {
        return true;
    }

    // Hide chats between two users that haven't been commented on from the LNH
    if (excludeEmptyChats && isEmptyChat && isChatReport(report) && !isChatRoom(report) && !isPolicyExpenseChat(report) && canHideReport) {
        return false;
    }

    return true;
}

/**
 * Attempts to find a report in onyx with the provided list of participants. Does not include threads, task, money request, room, and policy expense chat.
 */
function getChatByParticipants(newParticipantList: number[]): OnyxEntry<Report> | undefined {
    const sortedNewParticipantList = newParticipantList.sort((a, b) => a - b);
    return Object.values(allReports ?? {}).find((report) => {
        // If the report has been deleted, or there are no participants (like an empty #admins room) then skip it
        if (
            !report ||
            report.participantAccountIDs?.length === 0 ||
            isChatThread(report) ||
            isTaskReport(report) ||
            isMoneyRequestReport(report) ||
            isChatRoom(report) ||
            isPolicyExpenseChat(report)
        ) {
            return false;
        }

        // Only return the chat if it has all the participants
        return lodashIsEqual(
            sortedNewParticipantList,
            report.participantAccountIDs?.sort((a, b) => a - b),
        );
    });
}

/**
 * Attempts to find a report in onyx with the provided list of participants in given policy
 */
function getChatByParticipantsAndPolicy(newParticipantList: number[], policyID: string) {
    newParticipantList.sort();
    return Object.values(allReports ?? {}).find((report) => {
        // If the report has been deleted, or there are no participants (like an empty #admins room) then skip it
        if (!report?.participantAccountIDs) {
            return false;
        }
        const sortedParticipanctsAccountIDs = report.parentReportActionIDs?.sort((a, b) => a - b);
        // Only return the room if it has all the participants and is not a policy room
        return report.policyID === policyID && lodashIsEqual(newParticipantList, sortedParticipanctsAccountIDs);
    });
}

function getAllPolicyReports(policyID: string): Array<OnyxEntry<Report>> {
    return Object.values(allReports ?? {}).filter((report) => report?.policyID === policyID);
}

/**
 * Returns true if Chronos is one of the chat participants (1:1)
 */
function chatIncludesChronos(report: OnyxEntry<Report>): boolean {
    return Boolean(report?.participantAccountIDs && report.participantAccountIDs.includes(CONST.ACCOUNT_ID.CHRONOS));
}

/**
 * Can only flag if:
 *
 * - It was written by someone else and isn't a whisper
 * - It's a welcome message whisper
 * - It's an ADDCOMMENT that is not an attachment
 */
function canFlagReportAction(reportAction: OnyxEntry<ReportAction>, reportID: string | undefined): boolean {
    const report = getReport(reportID);
    const isCurrentUserAction = reportAction?.actorAccountID === currentUserAccountID;

    if (ReportActionsUtils.isWhisperAction(reportAction)) {
        // Allow flagging welcome message whispers as they can be set by any room creator
        if (report?.welcomeMessage && !isCurrentUserAction && reportAction?.originalMessage?.html === report.welcomeMessage) {
            return true;
        }

        // Disallow flagging the rest of whisper as they are sent by us
        return false;
    }

    return (
        !isCurrentUserAction &&
        reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.ADDCOMMENT &&
        !ReportActionsUtils.isDeletedAction(reportAction) &&
        !ReportActionsUtils.isCreatedTaskReportAction(reportAction) &&
        isAllowedToComment(report)
    );
}

/**
 * Whether flag comment page should show
 */
function shouldShowFlagComment(reportAction: OnyxEntry<ReportAction>, report: OnyxEntry<Report>): boolean {
    return (
        canFlagReportAction(reportAction, report?.reportID) &&
        !isArchivedRoom(report) &&
        !chatIncludesChronos(report) &&
        !isConciergeChatReport(report) &&
        reportAction?.actorAccountID !== CONST.ACCOUNT_ID.CONCIERGE
    );
}

function getNewMarkerReportActionID(report: OnyxEntry<Report>, sortedAndFilteredReportActions: ReportAction[]) {
    if (!isUnread(report)) {
        return '';
    }

    const newMarkerIndex = lodashFindLastIndex(sortedAndFilteredReportActions, (reportAction) => (reportAction.created ?? '') > (report?.lastReadTime ?? ''));

    return Object.hasOwn(sortedAndFilteredReportActions[newMarkerIndex], 'reportActionID') ? sortedAndFilteredReportActions[newMarkerIndex].reportActionID : '';
}

/**
 * Performs the markdown conversion, and replaces code points > 127 with C escape sequences
 * Used for compatibility with the backend auth validator for AddComment, and to account for MD in comments
 * @returns The comment's total length as seen from the backend
 */
function getCommentLength(textComment: string): number {
    return getParsedComment(textComment)
        .replace(/[^ -~]/g, '\\u????')
        .trim().length;
}

function getRouteFromLink(url: string | null): string {
    if (!url) {
        return '';
    }

    // Get the reportID from URL
    let route = url;
    linkingConfig.prefixes.forEach((prefix) => {
        const localWebAndroidRegEx = /^(http:\/\/([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3}))/;
        if (route.startsWith(prefix)) {
            route = route.replace(prefix, '');
        } else if (localWebAndroidRegEx.test(route)) {
            route = route.replace(localWebAndroidRegEx, '');
        } else {
            return;
        }

        // Remove the port if it's a localhost URL
        if (/^:\d+/.test(route)) {
            route = route.replace(/:\d+/, '');
        }

        // Remove the leading slash if exists
        if (route.startsWith('/')) {
            route = route.replace('/', '');
        }
    });
    return route;
}

function parseReportRouteParams(route: string) {
    let parsingRoute = route;
    if (parsingRoute.at(0) === '/') {
        // remove the first slash
        parsingRoute = parsingRoute.slice(1);
    }

    if (!parsingRoute.startsWith(Url.addTrailingForwardSlash('r'))) {
        return {reportID: '', isSubReportPageRoute: false};
    }

    const pathSegments = parsingRoute.split('/');

    const reportIDSegment = pathSegments[1];

    // Check for "undefined" or any other unwanted string values
    if (!reportIDSegment || reportIDSegment === 'undefined') {
        return {reportID: '', isSubReportPageRoute: false};
    }

    return {
        reportID: reportIDSegment,
        isSubReportPageRoute: pathSegments.length > 2,
    };
}

function getReportIDFromLink(url: string | null): string {
    const route = getRouteFromLink(url);
    const {reportID, isSubReportPageRoute} = parseReportRouteParams(route);
    if (isSubReportPageRoute) {
        // We allow the Sub-Report deep link routes (settings, details, etc.) to be handled by their respective component pages
        return '';
    }
    return reportID;
}

/**
 * Check if the chat report is linked to an iou that is waiting for the current user to add a credit bank account.
 */
function hasIOUWaitingOnCurrentUserBankAccount(chatReport: OnyxEntry<Report>): boolean {
    if (chatReport?.iouReportID) {
        const iouReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${chatReport?.iouReportID}`];
        if (iouReport?.isWaitingOnBankAccount && iouReport?.ownerAccountID === currentUserAccountID) {
            return true;
        }
    }

    return false;
}

/**
 * Users can request money:
 * - in policy expense chats only if they are in a role of a member in the chat (in other words, if it's their policy expense chat)
 * - in an open or submitted expense report tied to a policy expense chat the user owns
 *     - employee can request money in submitted expense report only if the policy has Instant Submit settings turned on
 * - in an IOU report, which is not settled yet
 * - in DM chat
 */
function canRequestMoney(report: OnyxEntry<Report>, participants: number[]) {
    // User cannot request money in chat thread or in task report
    if (isChatThread(report) || isTaskReport(report)) {
        return false;
    }

    // Prevent requesting money if pending IOU report waiting for their bank account already exists
    if (hasIOUWaitingOnCurrentUserBankAccount(report)) {
        return false;
    }

    // In case of expense reports, we have to look at the parent workspace chat to get the isOwnPolicyExpenseChat property
    let isOwnPolicyExpenseChat = report?.isOwnPolicyExpenseChat ?? false;
    if (isExpenseReport(report) && getParentReport(report)) {
        isOwnPolicyExpenseChat = Boolean(getParentReport(report)?.isOwnPolicyExpenseChat);
    }

    // In case there are no other participants than the current user and it's not user's own policy expense chat, they can't request money from such report
    if (participants.length === 0 && !isOwnPolicyExpenseChat) {
        return false;
    }

    // User can request money in any IOU report, unless paid, but user can only request money in an expense report
    // which is tied to their workspace chat.
    if (isMoneyRequestReport(report)) {
        return ((isExpenseReport(report) && isOwnPolicyExpenseChat) || isIOUReport(report)) && !isReportApproved(report) && !isSettled(report?.reportID);
    }

    // In case of policy expense chat, users can only request money from their own policy expense chat
    return !isPolicyExpenseChat(report) || isOwnPolicyExpenseChat;
}

/**
 * Helper method to define what money request options we want to show for particular method.
 * There are 3 money request options: Request, Split and Send:
 * - Request option should show for:
 *     - DMs
 *     - own policy expense chats
 *     - open and processing expense reports tied to own policy expense chat
 *     - unsettled IOU reports
 * - Send option should show for:
 *     - DMs
 * - Split options should show for:
 *     - chat/ policy rooms with more than 1 participants
 *     - groups chats with 3 and more participants
 *     - corporate workspace chats
 *
 * None of the options should show in chat threads or if there is some special Expensify account
 * as a participant of the report.
 */
function getMoneyRequestOptions(report: OnyxEntry<Report>, reportParticipants: number[]): (typeof CONST.IOU.TYPE)[keyof typeof CONST.IOU.TYPE][] {
    // In any thread or task report, we do not allow any new money requests yet
    if (isChatThread(report) || isTaskReport(report)) {
        return [];
    }

    const participants = reportParticipants.filter((accountID) => currentUserPersonalDetails?.accountID !== accountID);

    // Verify if there is any of the expensify accounts amongst the participants in which case user cannot take IOU actions on such report
    const hasExcludedIOUAccountIDs = lodashIntersection(reportParticipants, CONST.EXPENSIFY_ACCOUNT_IDS).length > 0;
    const hasSingleParticipantInReport = participants.length === 1;
    const hasMultipleParticipants = participants.length > 1;

    if (hasExcludedIOUAccountIDs) {
        return [];
    }

    // User created policy rooms and default rooms like #admins or #announce will always have the Split Bill option
    // unless there are no participants at all (e.g. #admins room for a policy with only 1 admin)
    // DM chats will have the Split Bill option only when there are at least 3 people in the chat.
    // There is no Split Bill option for IOU or Expense reports which are threads
    if (
        (isChatRoom(report) && participants.length > 0) ||
        (hasMultipleParticipants && !isPolicyExpenseChat(report) && !isMoneyRequestReport(report)) ||
        (isControlPolicyExpenseChat(report) && report?.isOwnPolicyExpenseChat)
    ) {
        return [CONST.IOU.TYPE.SPLIT];
    }

    // DM chats that only have 2 people will see the Send / Request money options.
    // IOU and open or processing expense reports should show the Request option.
    // Workspace chats should only see the Request money option or Split option in case of Control policies
    return [
        ...(canRequestMoney(report, participants) ? [CONST.IOU.TYPE.REQUEST] : []),

        // Send money option should be visible only in DMs
        ...(isChatReport(report) && !isPolicyExpenseChat(report) && hasSingleParticipantInReport ? [CONST.IOU.TYPE.SEND] : []),
    ];
}

/**
 * Allows a user to leave a policy room according to the following conditions of the visibility or chatType rNVP:
 * `public` - Anyone can leave (because anybody can join)
 * `public_announce` - Only non-policy members can leave (it's auto-shared with policy members)
 * `policy_admins` - Nobody can leave (it's auto-shared with all policy admins)
 * `policy_announce` - Nobody can leave (it's auto-shared with all policy members)
 * `policyExpenseChat` - Nobody can leave (it's auto-shared with all policy members)
 * `policy` - Anyone can leave (though only policy members can join)
 * `domain` - Nobody can leave (it's auto-shared with domain members)
 * `dm` - Nobody can leave (it's auto-shared with users)
 * `private` - Anybody can leave (though you can only be invited to join)
 */
function canLeaveRoom(report: OnyxEntry<Report>, isPolicyMember: boolean): boolean {
    if (!report?.visibility) {
        if (
            report?.chatType === CONST.REPORT.CHAT_TYPE.POLICY_ADMINS ||
            report?.chatType === CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE ||
            report?.chatType === CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT ||
            report?.chatType === CONST.REPORT.CHAT_TYPE.DOMAIN_ALL ||
            !report?.chatType
        ) {
            // DM chats don't have a chatType
            return false;
        }
    } else if (isPublicAnnounceRoom(report) && isPolicyMember) {
        return false;
    }
    return true;
}

function isCurrentUserTheOnlyParticipant(participantAccountIDs?: number[]): boolean {
    return Boolean(participantAccountIDs && participantAccountIDs.length === 1 && participantAccountIDs[0] === currentUserAccountID);
}

/**
 * Returns display names for those that can see the whisper.
 * However, it returns "you" if the current user is the only one who can see it besides the person that sent it.
 */
function getWhisperDisplayNames(participantAccountIDs?: number[]): string | undefined {
    const isWhisperOnlyVisibleToCurrentUser = isCurrentUserTheOnlyParticipant(participantAccountIDs);

    // When the current user is the only participant, the display name needs to be "you" because that's the only person reading it
    if (isWhisperOnlyVisibleToCurrentUser) {
        return Localize.translateLocal('common.youAfterPreposition');
    }

    return participantAccountIDs?.map((accountID) => getDisplayNameForParticipant(accountID, !isWhisperOnlyVisibleToCurrentUser)).join(', ');
}

/**
 * Show subscript on workspace chats / threads and expense requests
 */
function shouldReportShowSubscript(report: OnyxEntry<Report>): boolean {
    if (isArchivedRoom(report)) {
        return false;
    }

    if (isPolicyExpenseChat(report) && !isChatThread(report) && !isTaskReport(report) && !report?.isOwnPolicyExpenseChat) {
        return true;
    }

    if (isPolicyExpenseChat(report) && !isThread(report) && !isTaskReport(report)) {
        return true;
    }

    if (isExpenseRequest(report)) {
        return true;
    }

    if (isWorkspaceTaskReport(report)) {
        return true;
    }

    if (isWorkspaceThread(report)) {
        return true;
    }

    return false;
}

/**
 * Return true if reports data exists
 */
function isReportDataReady(): boolean {
    return Object.keys(allReports ?? {}).length !== 0 && Object.keys(allReports ?? {}).some((key) => allReports?.[key]?.reportID);
}

/**
 * Return true if reportID from path is valid
 */
function isValidReportIDFromPath(reportIDFromPath: string): boolean {
    return typeof reportIDFromPath === 'string' && !['', 'null', '0'].includes(reportIDFromPath);
}

/**
 * Return the errors we have when creating a chat or a workspace room
 */
function getAddWorkspaceRoomOrChatReportErrors(report: OnyxEntry<Report>) {
    // We are either adding a workspace room, or we're creating a chat, it isn't possible for both of these to have errors for the same report at the same time, so
    // simply looking up the first truthy value will get the relevant property if it's set.
    return report?.errorFields?.addWorkspaceRoom ?? report?.errorFields?.createChat;
}

/**
 * Returns true if write actions like assign task, money request, send message should be disabled on a report
 */
function shouldDisableWriteActions(report: OnyxEntry<Report>): boolean {
    const reportErrors = getAddWorkspaceRoomOrChatReportErrors(report);
    return isArchivedRoom(report) || Object.keys(reportErrors ?? {}).length !== 0 || !isAllowedToComment(report) || isAnonymousUser;
}

/**
 * Returns ID of the original report from which the given reportAction is first created.
 */
function getOriginalReportID(reportID: string, reportAction: OnyxEntry<ReportAction>): string | undefined {
    const currentReportAction = ReportActionsUtils.getReportAction(reportID, reportAction?.reportActionID ?? '');
    return isThreadFirstChat(reportAction, reportID) && Object.keys(currentReportAction ?? {}).length === 0
        ? allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`]?.parentReportID
        : reportID;
}

/**
 * Return the pendingAction and the errors we have when creating a chat or a workspace room offline
 */
function getReportOfflinePendingActionAndErrors(report: OnyxEntry<Report>) {
    // We are either adding a workspace room, or we're creating a chat, it isn't possible for both of these to be pending, or to have errors for the same report at the same time, so
    // simply looking up the first truthy value for each case will get the relevant property if it's set.
    const addWorkspaceRoomOrChatPendingAction = report?.pendingFields?.addWorkspaceRoom ?? report?.pendingFields?.createChat;
    const addWorkspaceRoomOrChatErrors = getAddWorkspaceRoomOrChatReportErrors(report);
    return {addWorkspaceRoomOrChatPendingAction, addWorkspaceRoomOrChatErrors};
}

function getPolicyExpenseChatReportIDByOwner(policyOwner: string) {
    const policyWithOwner = Object.values(allPolicies ?? {}).find((policy) => policy?.owner === policyOwner);
    if (!policyWithOwner) {
        return null;
    }

    const expenseChat = Object.values(allReports ?? {}).find((report) => isPolicyExpenseChat(report) && report?.policyID === policyWithOwner.id);
    if (!expenseChat) {
        return null;
    }
    return expenseChat.reportID;
}

function canCreateRequest(report: OnyxEntry<Report>, betas: Beta[], iouType: (typeof CONST.IOU.TYPE)[keyof typeof CONST.IOU.TYPE]): boolean {
    const participantAccountIDs = report?.participantAccountIDs ?? [];
    if (shouldDisableWriteActions(report)) {
        return false;
    }
    return getMoneyRequestOptions(report, participantAccountIDs, betas).includes(iouType);
}

function getWorkspaceChats(policyID: string, accountIDs: number[]) {
    return Object.values(allReports ?? {})?.filter((report) => isPolicyExpenseChat(report) && (report?.policyID ?? '') === policyID && accountIDs.includes(report?.ownerAccountID ?? -1));
}

/**
 * @param report
 * @param policy - the workspace the report is on, null if the user isn't a member of the workspace
 */
function shouldDisableRename(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>): boolean {
    if (isDefaultRoom(report) || isArchivedRoom(report) || isChatThread(report) || isMoneyRequestReport(report) || isPolicyExpenseChat(report)) {
        return true;
    }

    // if the linked workspace is null, that means the person isn't a member of the workspace the report is in
    // which means this has to be a public room we want to disable renaming for
    if (!policy) {
        return true;
    }

    // If there is a linked workspace, that means the user is a member of the workspace the report is in.
    // Still, we only want policy owners and admins to be able to modify the name.
    return !Object.keys(loginList ?? {}).includes(policy.owner) && policy.role !== CONST.POLICY.ROLE.ADMIN;
}

/**
 * Returns the onyx data needed for the task assignee chat
 */
function getTaskAssigneeChatOnyxData(
    accountID: number,
    assigneeEmail: string,
    assigneeAccountID: number,
    taskReportID: string,
    assigneeChatReportID: string,
    parentReportID: string,
    title: string,
    assigneeChatReport: OnyxEntry<Report>,
) {
    // Set if we need to add a comment to the assignee chat notifying them that they have been assigned a task
    let optimisticAssigneeAddComment;
    // Set if this is a new chat that needs to be created for the assignee
    let optimisticChatCreatedReportAction;
    const currentTime = DateUtils.getDBTime();
    const optimisticData = [];
    const successData = [];
    const failureData = [];

    // You're able to assign a task to someone you haven't chatted with before - so we need to optimistically create the chat and the chat reportActions
    // Only add the assignee chat report to onyx if we haven't already set it optimistically
    if (assigneeChatReport?.isOptimisticReport && assigneeChatReport.pendingFields?.createChat !== CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
        optimisticChatCreatedReportAction = buildOptimisticCreatedReportAction(assigneeChatReportID);
        optimisticData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
                value: {
                    pendingFields: {
                        createChat: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    },
                    isHidden: false,
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
                value: {[optimisticChatCreatedReportAction.reportActionID]: optimisticChatCreatedReportAction},
            },
        );

        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
            value: {
                pendingFields: {
                    createChat: null,
                },
                isOptimisticReport: false,
            },
        });

        failureData.push(
            {
                onyxMethod: Onyx.METHOD.SET,
                key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
                value: null,
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
                value: {[optimisticChatCreatedReportAction.reportActionID]: {pendingAction: null}},
            },
            // If we failed, we want to remove the optimistic personal details as it was likely due to an invalid login
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.PERSONAL_DETAILS_LIST,
                value: {
                    [assigneeAccountID]: null,
                },
            },
        );
    }

    // If you're choosing to share the task in the same DM as the assignee then we don't need to create another reportAction indicating that you've been assigned
    if (assigneeChatReportID !== parentReportID) {
        const displayname = allPersonalDetails?.[assigneeAccountID]?.displayName ?? allPersonalDetails?.[assigneeAccountID]?.login ?? '';
        optimisticAssigneeAddComment = buildOptimisticTaskCommentReportAction(taskReportID, title, assigneeEmail, assigneeAccountID, `assigned to ${displayname}`, parentReportID);
        const lastAssigneeCommentText = formatReportLastMessageText(optimisticAssigneeAddComment.reportAction.message?.[0].text ?? '');
        const optimisticAssigneeReport = {
            lastVisibleActionCreated: currentTime,
            lastMessageText: lastAssigneeCommentText,
            lastActorAccountID: accountID,
            lastReadTime: currentTime,
        };

        optimisticData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
                value: {[optimisticAssigneeAddComment.reportAction.reportActionID ?? '']: optimisticAssigneeAddComment.reportAction},
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
                value: optimisticAssigneeReport,
            },
        );
        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
            value: {[optimisticAssigneeAddComment.reportAction.reportActionID ?? '']: {pendingAction: null}},
        });
    }

    return {
        optimisticData,
        successData,
        failureData,
        optimisticAssigneeAddComment,
        optimisticChatCreatedReportAction,
    };
}

/**
 * Returns an array of the participants Ids of a report
 */
function getParticipantsIDs(report: OnyxEntry<Report>): Array<number | undefined> {
    if (!report) {
        return [];
    }

    const participants = report.participantAccountIDs ?? [];

    // Build participants list for IOU/expense reports
    if (isMoneyRequestReport(report)) {
        const onlyTruthyValues = [report.managerID, report.ownerAccountID, ...participants].filter(Boolean);
        const onlyUnique = [...new Set([...onlyTruthyValues])];
        return onlyUnique;
    }
    return participants;
}

/**
 * Return iou report action display message
 */
function getIOUReportActionDisplayMessage(reportAction: OnyxEntry<ReportAction>) {
    const originalMessage = reportAction?.originalMessage as IOUMessage;
    let displayMessage;
    if (originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.PAY) {
        const {amount, currency, IOUReportID} = originalMessage;
        const formattedAmount = CurrencyUtils.convertToDisplayString(amount, currency);
        const iouReport = getReport(String(IOUReportID) ?? '');
        const payerName = isExpenseReport(iouReport) ? getPolicyName(iouReport) : getDisplayNameForParticipant(iouReport?.managerID, true);
        let translationKey;
        switch (originalMessage.paymentType) {
            case CONST.IOU.PAYMENT_TYPE.ELSEWHERE:
                translationKey = 'iou.paidElsewhereWithAmount';
                break;
            case CONST.IOU.PAYMENT_TYPE.EXPENSIFY:
            case CONST.IOU.PAYMENT_TYPE.VBBA:
                translationKey = 'iou.paidUsingExpensifyWithAmount';
                break;
            default:
                translationKey = '';
                break;
        }
        displayMessage = Localize.translateLocal(translationKey, {amount: formattedAmount, payer: payerName});
    } else {
        const transaction = TransactionUtils.getTransaction(originalMessage.IOUTransactionID ?? '');
        const transactionDetails = transaction && isTypeTransaction(transaction) ? getTransactionDetails(transaction) : undefined;
        const formattedAmount = CurrencyUtils.convertToDisplayString(transactionDetails?.amount ?? 0, transactionDetails?.currency ?? '');
        displayMessage = Localize.translateLocal('iou.requestedAmount', {
            formattedAmount,
            comment: transactionDetails?.comment,
        });
    }
    return displayMessage;
}

function isReportDraft(report: OnyxEntry<Report>) {
    return isExpenseReport(report) && report?.stateNum === CONST.REPORT.STATE_NUM.OPEN && report.statusNum === CONST.REPORT.STATUS.OPEN;
}

function shouldUseFullTitleToDisplay(report: OnyxEntry<Report>) {
    return isMoneyRequestReport(report) || isPolicyExpenseChat(report) || isChatRoom(report) || isChatThread(report) || isTaskReport(report);
}

export {
    getReportParticipantsTitle,
    isReportMessageAttachment,
    findLastAccessedReport,
    canEditReportAction,
    canFlagReportAction,
    shouldShowFlagComment,
    canDeleteReportAction,
    canLeaveRoom,
    sortReportsByLastRead,
    isDefaultRoom,
    isAdminRoom,
    isAdminsOnlyPostingRoom,
    isAnnounceRoom,
    isUserCreatedPolicyRoom,
    isChatRoom,
    getChatRoomSubtitle,
    getParentNavigationSubtitle,
    getPolicyName,
    getPolicyType,
    isArchivedRoom,
    isExpensifyOnlyParticipantInReport,
    isPolicyExpenseChatAdmin,
    isPolicyAdmin,
    isPublicRoom,
    isPublicAnnounceRoom,
    isConciergeChatReport,
    isCurrentUserTheOnlyParticipant,
    hasAutomatedExpensifyAccountIDs,
    hasExpensifyGuidesEmails,
    isWaitingForIOUActionFromCurrentUser,
    isIOUOwnedByCurrentUser,
    getMoneyRequestReimbursableTotal,
    getMoneyRequestSpendBreakdown,
    canShowReportRecipientLocalTime,
    formatReportLastMessageText,
    chatIncludesConcierge,
    isPolicyExpenseChat,
    isControlPolicyExpenseChat,
    isControlPolicyExpenseReport,
    getIconsForParticipants,
    getIcons,
    getRoomWelcomeMessage,
    getDisplayNamesWithTooltips,
    getReportName,
    getReport,
    getReportIDFromLink,
    getRouteFromLink,
    getDeletedParentActionMessageForChatReport,
    getLastVisibleMessage,
    navigateToDetailsPage,
    generateReportID,
    hasReportNameError,
    isUnread,
    isUnreadWithMention,
    buildOptimisticWorkspaceChats,
    buildOptimisticTaskReport,
    buildOptimisticChatReport,
    buildOptimisticClosedReportAction,
    buildOptimisticCreatedReportAction,
    buildOptimisticEditedTaskReportAction,
    buildOptimisticIOUReport,
    buildOptimisticApprovedReportAction,
    buildOptimisticSubmittedReportAction,
    buildOptimisticExpenseReport,
    buildOptimisticIOUReportAction,
    buildOptimisticReportPreview,
    buildOptimisticModifiedExpenseReportAction,
    updateReportPreview,
    buildOptimisticTaskReportAction,
    buildOptimisticAddCommentReportAction,
    buildOptimisticTaskCommentReportAction,
    updateOptimisticParentReportAction,
    getOptimisticDataForParentReportAction,
    shouldReportBeInOptionList,
    getChatByParticipants,
    getChatByParticipantsAndPolicy,
    getAllPolicyReports,
    getIOUReportActionMessage,
    getDisplayNameForParticipant,
    getWorkspaceIcon,
    isOptimisticPersonalDetail,
    shouldDisableDetailPage,
    isChatReport,
    isCurrentUserSubmitter,
    isExpenseReport,
    isExpenseRequest,
    isIOUReport,
    isTaskReport,
    isOpenTaskReport,
    isCanceledTaskReport,
    isCompletedTaskReport,
    isReportManager,
    isReportApproved,
    isMoneyRequestReport,
    isMoneyRequest,
    chatIncludesChronos,
    getNewMarkerReportActionID,
    canSeeDefaultRoom,
    getDefaultWorkspaceAvatar,
    getCommentLength,
    getParsedComment,
    getMoneyRequestOptions,
    canCreateRequest,
    hasIOUWaitingOnCurrentUserBankAccount,
    canRequestMoney,
    getWhisperDisplayNames,
    getWorkspaceAvatar,
    isThread,
    isChatThread,
    isThreadFirstChat,
    isChildReport,
    shouldReportShowSubscript,
    isReportDataReady,
    isValidReportIDFromPath,
    isSettled,
    isAllowedToComment,
    getBankAccountRoute,
    getParentReport,
    getRootParentReport,
    getReportPreviewMessage,
    getModifiedExpenseMessage,
    shouldDisableWriteActions,
    getOriginalReportID,
    canAccessReport,
    getAddWorkspaceRoomOrChatReportErrors,
    getReportOfflinePendingActionAndErrors,
    isDM,
    getPolicy,
    getPolicyExpenseChatReportIDByOwner,
    getWorkspaceChats,
    shouldDisableRename,
    hasSingleParticipant,
    getReportRecipientAccountIDs,
    isOneOnOneChat,
    getTransactionReportName,
    getTransactionDetails,
    getTaskAssigneeChatOnyxData,
    getParticipantsIDs,
    canEditMoneyRequest,
    buildTransactionThread,
    areAllRequestsBeingSmartScanned,
    getTransactionsWithReceipts,
    hasOnlyDistanceRequestTransactions,
    hasNonReimbursableTransactions,
    hasMissingSmartscanFields,
    getIOUReportActionDisplayMessage,
    isWaitingForTaskCompleteFromAssignee,
    isReportDraft,
    shouldUseFullTitleToDisplay,
    parseReportRouteParams,
};
