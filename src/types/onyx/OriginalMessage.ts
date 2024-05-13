import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
import type DeepValueOf from '@src/types/utils/DeepValueOf';

/** Types of payments methods */
type PaymentMethodType = DeepValueOf<typeof CONST.IOU.PAYMENT_TYPE | typeof CONST.IOU.REPORT_ACTION_TYPE | typeof CONST.WALLET.TRANSFER_METHOD_TYPE>;

/** Names of report actions */
type ActionName = DeepValueOf<typeof CONST.REPORT.ACTIONS.TYPE>;

/** Names of task report actions */
type OriginalMessageActionName =
    | 'ADDCOMMENT'
    | 'APPROVED'
    | 'CHRONOSOOOLIST'
    | 'CLOSED'
    | 'CREATED'
    | 'HOLD'
    | 'UNHOLD'
    | 'IOU'
    | 'MODIFIEDEXPENSE'
    | 'REIMBURSEMENTQUEUED'
    | 'RENAMED'
    | 'REPORTPREVIEW'
    | 'SUBMITTED'
    | 'TASKCANCELLED'
    | 'TASKCOMPLETED'
    | 'TASKEDITED'
    | 'TASKREOPENED'
    | 'ACTIONABLEJOINREQUEST'
    | 'ACTIONABLEMENTIONWHISPER'
    | 'ACTIONABLEREPORTMENTIONWHISPER'
    | 'ACTIONABLETRACKEXPENSEWHISPER'
    | ValueOf<typeof CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG>;

/** Model of `approved` report action */
type OriginalMessageApproved = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.APPROVED;

    /** TODO: I think the type should match the scructure of `originalMessage` in `buildOptimisticApprovedReportAction` */
    originalMessage: unknown;
};

/** Types of sources of original message */
type OriginalMessageSource = 'Chronos' | 'email' | 'ios' | 'android' | 'web' | '';

/** Model of `hold` report action */
type OriginalMessageHold = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.HOLD;
    originalMessage: unknown;
};

/** Model of `hold comment` report action */
type OriginalMessageHoldComment = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.HOLD_COMMENT;
    originalMessage: unknown;
};

/** Model of `unhold` report action */
type OriginalMessageUnHold = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.UNHOLD;
    originalMessage: unknown;
};

/** Details provided when sending money */
type IOUDetails = {
    /** How much was sent */
    amount: number;

    /** Optional comment */
    comment?: string;

    /** Currency of the money sent */
    currency: string;
};

/** Model of original message of `IOU` report action */
type IOUMessage = {
    /** The ID of the `IOU` transaction */
    IOUTransactionID?: string;

    /** ID of the `IOU` report */
    IOUReportID?: string;

    /** ID of the expense report */
    expenseReportID?: string;

    /** How much was transactioned */
    amount: number;

    /** Optional comment */
    comment?: string;

    /** Currency of the transactioned money */
    currency: string;

    /** When was the `IOU` last modified */
    lastModified?: string;

    /** Who participated in the transaction, by accountID */
    participantAccountIDs?: number[];

    /** Type of `IOU` report action */
    type: ValueOf<typeof CONST.IOU.REPORT_ACTION_TYPE>;

    /** If the action was cancelled, this is the reason for the cancellation */
    cancellationReason?: string;

    /** Type of payment method used in transaction */
    paymentType?: PaymentMethodType;

    /** Timestamp of when the `IOU` report action was deleted */
    deleted?: string;

    /** Only exists when we are sending money */
    IOUDetails?: IOUDetails;
    whisperedTo?: number[];
};

/** Model of original message of `reimbursed dequeued` report action */
type ReimbursementDeQueuedMessage = {
    /** TODO: I'd replace this type with `ValueOf<typeof CONST.REPORT.CANCEL_PAYMENT_REASONS>` */
    /** Why the reimbursement was cancelled */
    cancellationReason: string;

    /** ID of the `expense` report */
    expenseReportID?: string;

    /** Amount that wasn't reimbursed */
    amount: number;

    /** Currency of the money that wasn't reimbursed */
    currency: string;
};

/** Model of `IOU` report action */
type OriginalMessageIOU = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.IOU;
    originalMessage: IOUMessage;
};

/** Names of severity flags */
type FlagSeverityName = ValueOf<
    Pick<
        typeof CONST.MODERATION,
        'FLAG_SEVERITY_SPAM' | 'FLAG_SEVERITY_INCONSIDERATE' | 'FLAG_SEVERITY_INTIMIDATION' | 'FLAG_SEVERITY_BULLYING' | 'FLAG_SEVERITY_HARASSMENT' | 'FLAG_SEVERITY_ASSAULT'
    >
>;

/** Model of severity flag */
type FlagSeverity = {
    /** Account ID of the user that flagged the comment */
    accountID: number;

    /** When was the comment flagged */
    timestamp: string;
};

/** Names of moderation decisions */
type DecisionName = ValueOf<
    Pick<
        typeof CONST.MODERATION,
        'MODERATOR_DECISION_PENDING' | 'MODERATOR_DECISION_PENDING_HIDE' | 'MODERATOR_DECISION_PENDING_REMOVE' | 'MODERATOR_DECISION_APPROVED' | 'MODERATOR_DECISION_HIDDEN'
    >
>;

/** Model of moderator decision */
type Decision = {
    /** Name of the decision */
    decision: DecisionName;

    /** When was the decision name */
    timestamp?: string;
};

/** Model of user reaction */
type User = {
    /** Account ID of the user that reacted to the comment */
    accountID: number;

    /** What's the skin tone of the user reaction */
    skinTone: number;
};

/** Model of comment reaction */
type Reaction = {
    /** Which emoji was used to react to the comment */
    emoji: string;

    /** Which users reacted with this emoji */
    users: User[];
};

/** Model of original message of `closed` report action */
type Closed = {
    /** Name of the policy */
    policyName: string;

    /** What was the reason to close the report */
    reason: ValueOf<typeof CONST.REPORT.ARCHIVE_REASON>;

    /** When was the message last modified */
    lastModified?: string;

    /** If the report was closed because accounts got merged, then this is the new account ID */
    newAccountID?: number;

    /** If the report was closed because accounts got merged, then this is the old account ID */
    oldAccountID?: number;
};

/** Model of `add comment` report action */
type OriginalMessageAddComment = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT;
    originalMessage: {
        /** HTML content of the comment */
        html: string;

        /** Origin of the comment */
        source?: OriginalMessageSource;

        /** When was the comment last modified */
        lastModified?: string;

        /** ID of the task report */
        taskReportID?: string;

        /** TODO: Doesn't exist in the app */
        edits?: string[];

        /** TODO: Doesn't exist in the app */
        childReportID?: string;

        /** TODO: Doesn't exist in the app */
        isDeletedParentAction?: boolean;

        /** TODO: Doesn't exist in the app */
        flags?: Record<FlagSeverityName, FlagSeverity[]>;

        /** TODO: Doesn't exist in the app */
        moderationDecisions?: Decision[];

        /** TODO: Only used in tests  */
        whisperedTo: number[];

        /** TODO: Doesn't exist in the app */
        reactions?: Reaction[];
    };
};

/** Model of `actionable mention whisper` report action */
type OriginalMessageActionableMentionWhisper = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.ACTIONABLE_MENTION_WHISPER;
    originalMessage: {
        /** Account IDs of users that aren't members of the room  */
        inviteeAccountIDs: number[];

        /** TODO: Doesn't exist in the app */
        inviteeEmails: string;

        /** TODO: Only used in tests */
        lastModified: string;

        /** TODO: Doesn't exist in the app */
        reportID: number;

        /** Decision on whether to invite users that were mentioned but aren't members or do nothing */
        resolution?: ValueOf<typeof CONST.REPORT.ACTIONABLE_MENTION_WHISPER_RESOLUTION> | null;

        /** TODO: Doesn't exist in the app */
        whisperedTo?: number[];
    };
};

/** Model of `actionable report mention whisper` report action */
type OriginalMessageActionableReportMentionWhisper = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.ACTIONABLE_REPORT_MENTION_WHISPER;
    originalMessage: {
        /** TODO: Doesn't exist in the app */
        reportNames: string[];

        /** TODO: Doesn't exist in the app */
        mentionedAccountIDs: number[];

        /** TODO: Doesn't exist in the app */
        reportActionID: number;

        /** TODO: Doesn't exist in the app */
        reportID: number;

        /** TODO: Only used in tests */
        lastModified: string;

        /** Decision on whether to create a report that were mentioned but doesn't exist or do nothing */
        resolution?: ValueOf<typeof CONST.REPORT.ACTIONABLE_REPORT_MENTION_WHISPER_RESOLUTION> | null;

        /** TODO: Doesn't exist in the app */
        whisperedTo?: number[];
    };
};

/** Model of `submitted` report action */
type OriginalMessageSubmitted = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.SUBMITTED;

    /** TODO: I think the type should match the scructure of `originalMessage` in `buildOptimisticSubmittedReportAction` */
    originalMessage: unknown;
};

/** Model of `closed` report action */
type OriginalMessageClosed = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.CLOSED;
    originalMessage: Closed;
};

/** Model of `created` report action */
type OriginalMessageCreated = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.CREATED;
    originalMessage?: unknown;
};

/** Model of `marked reimbursed` report action */
type OriginalMessageMarkedReimbursed = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.MARKED_REIMBURSED;
    originalMessage?: unknown;
};

/** Model of `renamed` report action, created when chat rooms get renamed */
type OriginalMessageRenamed = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.RENAMED;
    originalMessage: {
        /** Renamed room comment */
        html: string;

        /** When was report action last modified */
        lastModified: string;

        /** Old room name */
        oldName: string;

        /** New room name */
        newName: string;
    };
};

/** Model of Chronos OOO Timestamp */
type ChronosOOOTimestamp = {
    /** Date timestamp */
    date: string;

    /** TODO: Doesn't exist in the app */
    /** Timezone code */
    timezone: string;

    /** TODO: Doesn't exist in the app */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    timezone_type: number;
};

/** Model of change log */
type ChangeLog = {
    /** Account IDs of users that either got invited or removed from the room */
    targetAccountIDs?: number[];

    /** Name of the chat room */
    roomName?: string;

    /** ID of the report */
    reportID?: number;
};

/** Model of Chronos OOO Event */
type ChronosOOOEvent = {
    /** ID of the OOO event */
    id: string;

    /** How many days will the user be OOO */
    lengthInDays: number;

    /** Description of the OOO state */
    summary: string;

    /** When will the OOO state start */
    start: ChronosOOOTimestamp;

    /** When will the OOO state end */
    end: ChronosOOOTimestamp;
};

/** Model of `Chronos OOO List` report action */
type OriginalMessageChronosOOOList = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.CHRONOS_OOO_LIST;
    originalMessage: {
        /** TODO: Doesn't exist in the app */
        edits: string[];

        /** Collection of OOO events to show in report action */
        events: ChronosOOOEvent[];

        /** TODO: Only used in tests */
        html: string;

        /** TODO: Only used in tests */
        lastModified: string;
    };
};

/** Model of `report preview` report action */
type OriginalMessageReportPreview = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW;
    originalMessage: {
        /** ID of the report to be previewed */
        linkedReportID: string;

        /** TODO: Only used in tests */
        lastModified?: string;
        whisperedTo?: number[];
    };
};

/** Model of `policy change log` report action */
type OriginalMessagePolicyChangeLog = {
    actionName: ValueOf<typeof CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG>;
    originalMessage: ChangeLog;
};

/** Model of `join policy change log` report action */
type OriginalMessageJoinPolicyChangeLog = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.ACTIONABLE_JOIN_REQUEST;
    originalMessage: {
        /** TODO: I think this type could be changed to `ValueOf<typeof CONST.REPORT.ACTIONABLE_MENTION_JOIN_WORKSPACE_RESOLUTION>` */
        /** What was the invited user decision */
        choice: string;

        /** TODO: Doesn't exist in the app */
        email: string;

        /** TODO: Doesn't exist in the app */
        inviterEmail: string;

        /** TODO: Only used in tests */
        lastModified: string;

        /** TODO: Doesn't exist in the app */
        policyID: string;
    };
};

/** Model of `room change log` report action */
type OriginalMessageRoomChangeLog = {
    actionName: ValueOf<typeof CONST.REPORT.ACTIONS.TYPE.ROOM_CHANGE_LOG>;
    originalMessage: ChangeLog;
};

/** Model of `policy task` report action */
type OriginalMessagePolicyTask = {
    actionName:
        | typeof CONST.REPORT.ACTIONS.TYPE.TASK_EDITED
        | typeof CONST.REPORT.ACTIONS.TYPE.TASK_CANCELLED
        | typeof CONST.REPORT.ACTIONS.TYPE.TASK_COMPLETED
        | typeof CONST.REPORT.ACTIONS.TYPE.TASK_REOPENED
        | typeof CONST.REPORT.ACTIONS.TYPE.MODIFIED_EXPENSE;
    originalMessage: unknown;
};

/** Model of `modified expense` report action */
type OriginalMessageModifiedExpense = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.MODIFIED_EXPENSE;
    /** TODO: I think this type could be replaced by `ExpenseOriginalMessage` from `ReportUtils.ts` */
    originalMessage: {
        oldMerchant?: string;
        merchant?: string;
        oldCurrency?: string;
        currency?: string;
        oldAmount?: number;
        amount?: number;
        oldComment?: string;
        newComment?: string;
        oldCreated?: string;
        created?: string;
        oldCategory?: string;
        category?: string;
        oldTag?: string;
        tag?: string;
        oldTaxAmount?: number;
        taxAmount?: number;
        oldTaxRate?: string;
        taxRate?: string;
        oldBillable?: string;
        billable?: string;
        whisperedTo?: number[];
    };
};

/** Model of `reimbursement queued` report action */
type OriginalMessageReimbursementQueued = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_QUEUED;
    originalMessage: {
        /** How is the payment getting reimbursed */
        paymentType: DeepValueOf<typeof CONST.IOU.PAYMENT_TYPE>;
    };
};

/** Model of `actionable tracked expense whisper` report action */
type OriginalMessageActionableTrackedExpenseWhisper = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.ACTIONABLE_TRACK_EXPENSE_WHISPER;
    originalMessage: {
        /** ID of the transaction */
        transactionID: string;

        /** TODO: Only used in tests */
        lastModified: string;

        /** What was the decision of the user */
        resolution?: ValueOf<typeof CONST.REPORT.ACTIONABLE_TRACK_EXPENSE_WHISPER_RESOLUTION>;
    };
};

/** Model of `reimbursement dequeued` report action */
type OriginalMessageReimbursementDequeued = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_DEQUEUED;

    /** TODO: I think this type should be `ReimbursementDeQueuedMessage` */
    originalMessage: {
        /** ID of the expense report */
        expenseReportID: string;
    };
};

/** Model of `moved` report action */
type OriginalMessageMoved = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.MOVED;
    originalMessage: {
        /** ID of the old policy */
        fromPolicyID: string;

        /** ID of the new policy */
        toPolicyID: string;

        /** ID of the new parent report */
        newParentReportID: string;

        /** ID of the moved report */
        movedReportID: string;
    };
};

/** Model of `merged with cash transaction` report action */
type OriginalMessageMergedWithCashTransaction = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.MERGED_WITH_CASH_TRANSACTION;
    originalMessage: Record<string, never>; // No data is sent with this action
};

/** Model of `dismissed violation` report action */
type OriginalMessageDismissedViolation = {
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.DISMISSED_VIOLATION;
    originalMessage: {
        /** Why the violation was dismissed */
        reason: string;

        /** Name of the violation */
        violationName: string;
    };
};

/** Model of report action */
type OriginalMessage =
    | OriginalMessageApproved
    | OriginalMessageIOU
    | OriginalMessageAddComment
    | OriginalMessageActionableMentionWhisper
    | OriginalMessageActionableReportMentionWhisper
    | OriginalMessageSubmitted
    | OriginalMessageClosed
    | OriginalMessageCreated
    | OriginalMessageHold
    | OriginalMessageHoldComment
    | OriginalMessageUnHold
    | OriginalMessageRenamed
    | OriginalMessageChronosOOOList
    | OriginalMessageReportPreview
    | OriginalMessageRoomChangeLog
    | OriginalMessagePolicyChangeLog
    | OriginalMessagePolicyTask
    | OriginalMessageJoinPolicyChangeLog
    | OriginalMessageModifiedExpense
    | OriginalMessageReimbursementQueued
    | OriginalMessageReimbursementDequeued
    | OriginalMessageMoved
    | OriginalMessageMarkedReimbursed
    | OriginalMessageActionableTrackedExpenseWhisper
    | OriginalMessageMergedWithCashTransaction
    | OriginalMessageDismissedViolation;

export default OriginalMessage;
export type {
    ChronosOOOEvent,
    Decision,
    Reaction,
    ActionName,
    IOUMessage,
    ReimbursementDeQueuedMessage,
    Closed,
    OriginalMessageActionName,
    ChangeLog,
    OriginalMessageIOU,
    OriginalMessageCreated,
    OriginalMessageRenamed,
    OriginalMessageAddComment,
    OriginalMessageJoinPolicyChangeLog,
    OriginalMessageActionableMentionWhisper,
    OriginalMessageActionableReportMentionWhisper,
    OriginalMessageReportPreview,
    OriginalMessageModifiedExpense,
    OriginalMessageChronosOOOList,
    OriginalMessageRoomChangeLog,
    OriginalMessageSource,
    OriginalMessageReimbursementDequeued,
    DecisionName,
    PaymentMethodType,
    OriginalMessageActionableTrackedExpenseWhisper,
    OriginalMessageDismissedViolation,
};
