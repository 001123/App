import {ValueOf} from 'type-fest';
import {SvgProps} from 'react-native-svg';
import OriginalMessage, {Decision, Reaction} from './OriginalMessage';
import * as OnyxCommon from './OnyxCommon';
import CONST from '../../CONST';
import {Receipt} from './Transaction';

type Message = {
    /** The type of the action item fragment. Used to render a corresponding component */
    type: string;

    /** The html content of the fragment. */
    html?: string;

    /** The text content of the fragment. */
    text: string;

    /** Used to apply additional styling. Style refers to a predetermined constant and not a class name. e.g. 'normal'
     * or 'strong'
     */
    style?: string;

    /** ID of a report */
    reportID?: string;

    /** ID of a policy */
    policyID?: string;

    /** The target of a link fragment e.g. '_blank' */
    target?: string;

    /** The destination of a link fragment e.g. 'https://www.expensify.com' */
    href?: string;

    /** An additional avatar url - not the main avatar url but used within a message. */
    iconUrl?: string;

    /** Fragment edited flag */
    isEdited?: boolean;

    isDeletedParentAction?: boolean;
    whisperedTo?: number[];
    reactions?: Reaction[];
    taskReportID?: string;
    translationKey?: string;
    moderationDecision?: Decision;
    isReversedTransaction?: boolean;
};

type Person = {
    type?: string;
    style?: string;
    text?: string;
};

type ReportActionBase = {
    /** The ID of the reportAction. It is the string representation of the a 64-bit integer. */
    reportActionID: string;

    /** @deprecated Used in old report actions before migration. Replaced by reportActionID. */
    sequenceNumber?: number;

    /** The ID of the previous reportAction on the report. It is a string represenation of a 64-bit integer (or null for CREATED actions). */
    previousReportActionID?: string;

    actorAccountID?: number;

    /** Person who created the action */
    person?: Person[];

    /** ISO-formatted datetime */
    created: string;

    /** report action message */
    message?: Message[];

    /** Whether we have received a response back from the server */
    isLoading?: boolean;

    /** accountIDs of the people to which the whisper was sent to (if any). Returns empty array if it is not a whisper */
    whisperedToAccountIDs?: Array<number | undefined>;

    avatar?: string | React.FC<SvgProps>;
    automatic?: boolean;
    shouldShow?: boolean;
    childReportID?: string;
    childReportName?: string;
    childType?: string;
    childOldestFourEmails?: string;
    childOldestFourAccountIDs?: string;
    childCommenterCount?: number;
    childLastVisibleActionCreated?: string;
    childVisibleActionCount?: number;
    parentReportID?: string;
    childManagerAccountID?: number;
    childStatusNum?: ValueOf<typeof CONST.REPORT.STATUS>;
    childStateNum?: ValueOf<typeof CONST.REPORT.STATE_NUM>;
    childLastReceiptTransactionIDs?: string;
    childLastMoneyRequestComment?: string;
    childMoneyRequestCount?: number;
    isFirstItem?: boolean;
    attachmentInfo?: (File & {source: string; uri: string}) | Record<string, never>;
    receipt?: Receipt;

    /** ISO-formatted datetime */
    lastModified?: string;

    pendingAction?: OnyxCommon.PendingAction;
    delegateAccountID?: string;

    /** Server side errors keyed by microtime */
    errors?: OnyxCommon.Errors;

    isAttachment?: boolean;
    childRecentReceiptTransactionIDs?: Record<string, string>;
};

type ReportAction = ReportActionBase & OriginalMessage;

type ReportActions = Record<string, ReportAction>;

export default ReportAction;
export type {ReportActions, Message};
