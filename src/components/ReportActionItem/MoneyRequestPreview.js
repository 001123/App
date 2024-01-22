import ExpensiMark from 'expensify-common/lib/ExpensiMark';
import {truncate} from 'lodash';
import lodashGet from 'lodash/get';
import PropTypes from 'prop-types';
import React, {useMemo} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import _ from 'underscore';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import MoneyRequestSkeletonView from '@components/MoneyRequestSkeletonView';
import MultipleAvatars from '@components/MultipleAvatars';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import PressableWithFeedback from '@components/Pressable/PressableWithoutFeedback';
import refPropTypes from '@components/refPropTypes';
import RenderHTML from '@components/RenderHTML';
import {showContextMenuForReport} from '@components/ShowContextMenuContext';
import Text from '@components/Text';
import transactionPropTypes from '@components/transactionPropTypes';
import useLocalize from '@hooks/useLocalize';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import ControlSelection from '@libs/ControlSelection';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import * as DeviceCapabilities from '@libs/DeviceCapabilities';
import * as IOUUtils from '@libs/IOUUtils';
import * as OptionsListUtils from '@libs/OptionsListUtils';
import * as ReceiptUtils from '@libs/ReceiptUtils';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import * as TransactionUtils from '@libs/TransactionUtils';
import {transactionViolationsPropType} from '@libs/Violations/propTypes';
import walletTermsPropTypes from '@pages/EnablePayments/walletTermsPropTypes';
import reportActionPropTypes from '@pages/home/report/reportActionPropTypes';
import iouReportPropTypes from '@pages/iouReportPropTypes';
import reportPropTypes from '@pages/reportPropTypes';
import * as PaymentMethods from '@userActions/PaymentMethods';
import * as Report from '@userActions/Report';
import CONST from '@src/CONST';
import * as Localize from '@src/libs/Localize';
import ONYXKEYS from '@src/ONYXKEYS';
import ReportActionItemImages from './ReportActionItemImages';

const propTypes = {
    /** The active IOUReport, used for Onyx subscription */
    // eslint-disable-next-line react/no-unused-prop-types
    iouReportID: PropTypes.string.isRequired,

    /** The associated chatReport */
    chatReportID: PropTypes.string.isRequired,

    /** Callback for the preview pressed */
    onPreviewPressed: PropTypes.func,

    /** All the data of the action, used for showing context menu */
    action: PropTypes.shape(reportActionPropTypes),

    /** Popover context menu anchor, used for showing context menu */
    contextMenuAnchor: refPropTypes,

    /** Callback for updating context menu active state, used for showing context menu */
    checkIfContextMenuActive: PropTypes.func,

    /** Extra styles to pass to View wrapper */
    // eslint-disable-next-line react/forbid-prop-types
    containerStyles: PropTypes.arrayOf(PropTypes.object),

    /* Onyx Props */

    /** chatReport associated with iouReport */
    chatReport: reportPropTypes,

    /** IOU report data object */
    iouReport: iouReportPropTypes,

    /** True if this is this IOU is a split instead of a 1:1 request */
    isBillSplit: PropTypes.bool.isRequired,

    /** True if the IOU Preview card is hovered */
    isHovered: PropTypes.bool,

    /** All of the personal details for everyone */
    personalDetails: PropTypes.objectOf(
        PropTypes.shape({
            /** This is either the user's full name, or their login if full name is an empty string */
            displayName: PropTypes.string,
        }),
    ),

    /** The transaction attached to the action.message.iouTransactionID */
    transaction: transactionPropTypes,

    /** Session info for the currently logged in user. */
    session: PropTypes.shape({
        /** Currently logged in user email */
        email: PropTypes.string,
    }),

    /** Information about the user accepting the terms for payments */
    walletTerms: walletTermsPropTypes,

    /** Whether or not an IOU report contains money requests in a different currency
     * that are either created or cancelled offline, and thus haven't been converted to the report's currency yet
     */
    shouldShowPendingConversionMessage: PropTypes.bool,

    /** Whether a message is a whisper */
    isWhisper: PropTypes.bool,

    /** All transactionViolations */
    transactionViolations: transactionViolationsPropType,
};

const defaultProps = {
    iouReport: {},
    onPreviewPressed: null,
    action: undefined,
    contextMenuAnchor: undefined,
    checkIfContextMenuActive: () => {},
    containerStyles: [],
    walletTerms: {},
    chatReport: {},
    isHovered: false,
    personalDetails: {},
    session: {
        email: null,
    },
    transaction: {},
    shouldShowPendingConversionMessage: false,
    isWhisper: false,
    transactionViolations: {},
};

// We should not render the component if there is no iouReport and it's not a split.
// Moved outside of the component scope to allow memoization of values later.
function MoneyRequestPreviewWrapper(props) {
    // eslint-disable-next-line react/jsx-props-no-spreading
    return _.isEmpty(props.iouReport) && !props.isBillSplit ? null : <MoneyRequestPreview {...props} />;
}

function MoneyRequestPreview(props) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const {translate} = useLocalize();
    const {isSmallScreenWidth, windowWidth} = useWindowDimensions();
    const parser = new ExpensiMark();

    const sessionAccountID = lodashGet(props.session, 'accountID', null);
    const managerID = props.iouReport.managerID || '';
    const ownerAccountID = props.iouReport.ownerAccountID || '';
    const isPolicyExpenseChat = ReportUtils.isPolicyExpenseChat(props.chatReport);

    const participantAccountIDs = props.isBillSplit ? lodashGet(props.action, 'originalMessage.participantAccountIDs', []) : [managerID, ownerAccountID];
    const participantAvatars = OptionsListUtils.getAvatarsForAccountIDs(participantAccountIDs, props.personalDetails);
    const sortedParticipantAvatars = _.sortBy(participantAvatars, (avatar) => avatar.id);
    if (isPolicyExpenseChat && props.isBillSplit) {
        sortedParticipantAvatars.push(ReportUtils.getWorkspaceIcon(props.chatReport));
    }

    // Pay button should only be visible to the manager of the report.
    const isCurrentUserManager = managerID === sessionAccountID;

    const {amount: requestAmount, currency: requestCurrency, comment: requestComment, merchant} = ReportUtils.getTransactionDetails(props.transaction);
    const description = truncate(requestComment, {length: CONST.REQUEST_PREVIEW.MAX_LENGTH});
    const requestMerchant = truncate(merchant, {length: CONST.REQUEST_PREVIEW.MAX_LENGTH});
    const hasReceipt = TransactionUtils.hasReceipt(props.transaction);
    const isScanning = hasReceipt && TransactionUtils.isReceiptBeingScanned(props.transaction);
    const hasViolations = TransactionUtils.hasViolation(props.transaction, props.transactionViolations);
    const hasFieldErrors = TransactionUtils.hasMissingSmartscanFields(props.transaction) || hasViolations;
    const isDistanceRequest = TransactionUtils.isDistanceRequest(props.transaction);
    const isExpensifyCardTransaction = TransactionUtils.isExpensifyCardTransaction(props.transaction);
    const isSettled = ReportUtils.isSettled(props.iouReport.reportID);
    const isDeleted = lodashGet(props.action, 'pendingAction', null) === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;

    // Show the merchant for IOUs and expenses only if they are custom or not related to scanning smartscan
    const shouldShowMerchant = !_.isEmpty(requestMerchant) && requestMerchant !== CONST.TRANSACTION.PARTIAL_TRANSACTION_MERCHANT && requestMerchant !== CONST.TRANSACTION.DEFAULT_MERCHANT;
    const shouldShowDescription = !_.isEmpty(description) && !shouldShowMerchant && !isScanning;
    const hasPendingWaypoints = lodashGet(props.transaction, 'pendingFields.waypoints', null);

    let merchantOrDescription = requestMerchant;
    if (!shouldShowMerchant) {
        merchantOrDescription = description || '';
    } else if (hasPendingWaypoints) {
        merchantOrDescription = requestMerchant.replace(CONST.REGEX.FIRST_SPACE, translate('common.tbd'));
    }

    const receiptImages = hasReceipt ? [ReceiptUtils.getThumbnailAndImageURIs(props.transaction)] : [];

    const getSettledMessage = useMemo(() => {
        if (isExpensifyCardTransaction) {
            return translate('common.done');
        }
        return translate('iou.settledExpensify');
    }, [isExpensifyCardTransaction, translate]);

    const showContextMenu = (event) => {
        showContextMenuForReport(event, props.contextMenuAnchor, props.chatReportID, props.action, props.checkIfContextMenuActive);
    };

    const previewHeaderText = useMemo(() => {
        if (isDistanceRequest) {
            return translate('common.distance');
        }

        if (isScanning) {
            return translate('common.receipt');
        }

        if (props.isBillSplit) {
            return translate('iou.split');
        }

        if (isExpensifyCardTransaction) {
            let message = translate('iou.card');
            if (TransactionUtils.isPending(props.transaction)) {
                message += ` • ${translate('iou.pending')}`;
            }
            return message;
        }

        let message = translate('iou.cash');
        if (hasViolations) {
            const violations = TransactionUtils.getTransactionViolations(props.transaction, props.transactionViolations);
            const violation = translate(`violations.${violations[0].name}`, violations[0].data);
            const isTooLong = _.filter(violations, (v) => v.type === 'violation').length > 1 || violation.length > 15;
            message += ` • ${isTooLong ? translate('violations.reviewRequired') : violation}`;
        }
        if (ReportUtils.isPaidGroupPolicyExpenseReport(props.iouReport) && ReportUtils.isReportApproved(props.iouReport) && !ReportUtils.isSettled(props.iouReport)) {
            message += ` • ${translate('iou.approved')}`;
        } else if (props.iouReport.isWaitingOnBankAccount) {
            message += ` • ${translate('iou.pending')}`;
        } else if (props.iouReport.isCancelledIOU) {
            message += ` • ${translate('iou.canceled')}`;
        }
        return message + (isSettled && !props.iouReport.isCancelledIOU ? ` • ${getSettledMessage}` : '');
    }, [
        getSettledMessage,
        hasViolations,
        isDistanceRequest,
        isExpensifyCardTransaction,
        isScanning,
        isSettled,
        props.iouReport,
        props.isBillSplit,
        props.transaction,
        props.transactionViolations,
        translate,
    ]);

    const displayAmountText = useMemo(() => {
        if (isDistanceRequest) {
            return requestAmount && !hasPendingWaypoints ? CurrencyUtils.convertToDisplayString(requestAmount, requestCurrency) : translate('common.tbd');
        }

        if (isScanning) {
            return translate('iou.receiptScanning');
        }

        if (!isSettled && TransactionUtils.hasMissingSmartscanFields(props.transaction)) {
            return Localize.translateLocal('iou.receiptMissingDetails');
        }

        return CurrencyUtils.convertToDisplayString(requestAmount, requestCurrency);
    }, [hasPendingWaypoints, isDistanceRequest, isScanning, props.transaction, requestAmount, requestCurrency, translate]);

    const displayDeleteAmountText = useMemo(() => {
        const {amount, currency} = ReportUtils.getTransactionDetails(props.action.originalMessage);

        if (isDistanceRequest) {
            return CurrencyUtils.convertToDisplayString(TransactionUtils.getAmount(props.action.originalMessage), currency);
        }

        return CurrencyUtils.convertToDisplayString(amount, currency);
    }, [isDistanceRequest, props.action.originalMessage]);

    const displayAmount = isDeleted ? displayDeleteAmountText : displayAmountText;

    const childContainer = (
        <View>
            <OfflineWithFeedback
                errors={props.walletTerms.errors}
                onClose={() => {
                    PaymentMethods.clearWalletTermsError();
                    Report.clearIOUError(props.chatReportID);
                }}
                errorRowStyles={[styles.mbn1]}
                needsOffscreenAlphaCompositing
            >
                <View
                    style={[
                        isScanning || props.isWhisper ? [styles.reportPreviewBoxHoverBorder, styles.reportContainerBorderRadius] : undefined,
                        !props.onPreviewPressed ? [styles.moneyRequestPreviewBox, ...props.containerStyles] : {},
                    ]}
                >
                    {hasReceipt && (
                        <ReportActionItemImages
                            images={receiptImages}
                            isHovered={props.isHovered || isScanning}
                            size={1}
                        />
                    )}
                    {_.isEmpty(props.transaction) &&
                    !ReportActionsUtils.isMessageDeleted(props.action) &&
                    lodashGet(props.action, 'pendingAction') !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE ? (
                        <MoneyRequestSkeletonView />
                    ) : (
                        <View style={styles.moneyRequestPreviewBoxText}>
                            <View style={[styles.flexRow]}>
                                <Text style={[styles.textLabelSupporting, styles.flex1, styles.lh20, styles.mb1]}>{previewHeaderText}</Text>
                                {!isSettled && hasFieldErrors && (
                                    <Icon
                                        src={Expensicons.DotIndicator}
                                        fill={theme.danger}
                                    />
                                )}
                            </View>
                            <View style={[styles.flexRow]}>
                                <View style={[styles.flex1, styles.flexRow, styles.alignItemsCenter]}>
                                    <Text
                                        style={[
                                            styles.textHeadline,
                                            props.isBillSplit &&
                                                StyleUtils.getAmountFontSizeAndLineHeight(isSmallScreenWidth, windowWidth, displayAmount.length, sortedParticipantAvatars.length),
                                            isDeleted && styles.lineThrough,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {displayAmount}
                                    </Text>
                                    {ReportUtils.isSettled(props.iouReport.reportID) && !props.isBillSplit && (
                                        <View style={styles.defaultCheckmarkWrapper}>
                                            <Icon
                                                src={Expensicons.Checkmark}
                                                fill={theme.iconSuccessFill}
                                            />
                                        </View>
                                    )}
                                </View>
                                {props.isBillSplit && (
                                    <View style={styles.moneyRequestPreviewBoxAvatar}>
                                        <MultipleAvatars
                                            icons={sortedParticipantAvatars}
                                            shouldStackHorizontally
                                            size="small"
                                            isHovered={props.isHovered}
                                            shouldUseCardBackground
                                        />
                                    </View>
                                )}
                            </View>
                            <View style={[styles.flexRow, styles.mt1]}>
                                <View style={[styles.flex1]}>
                                    {!isCurrentUserManager && props.shouldShowPendingConversionMessage && (
                                        <Text style={[styles.textLabel, styles.colorMuted]}>{translate('iou.pendingConversionMessage')}</Text>
                                    )}
                                    {shouldShowDescription && <RenderHTML html={parser.replace(merchantOrDescription)} />}
                                    {shouldShowMerchant && <Text style={[styles.textLabelSupporting, styles.textNormal]}>{merchantOrDescription}</Text>}
                                </View>
                                {props.isBillSplit && !_.isEmpty(participantAccountIDs) && requestAmount > 0 && (
                                    <Text style={[styles.textLabel, styles.colorMuted, styles.ml1, styles.amountSplitPadding]}>
                                        {translate('iou.amountEach', {
                                            amount: CurrencyUtils.convertToDisplayString(
                                                IOUUtils.calculateAmount(isPolicyExpenseChat ? 1 : participantAccountIDs.length - 1, requestAmount, requestCurrency),
                                                requestCurrency,
                                            ),
                                        })}
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </OfflineWithFeedback>
        </View>
    );

    if (!props.onPreviewPressed) {
        return childContainer;
    }

    const shouldDisableOnPress = props.isBillSplit && _.isEmpty(props.transaction);

    return (
        <PressableWithFeedback
            onPress={shouldDisableOnPress ? undefined : props.onPreviewPressed}
            onPressIn={() => DeviceCapabilities.canUseTouchScreen() && ControlSelection.block()}
            onPressOut={() => ControlSelection.unblock()}
            onLongPress={showContextMenu}
            accessibilityLabel={props.isBillSplit ? translate('iou.split') : translate('iou.cash')}
            accessibilityHint={CurrencyUtils.convertToDisplayString(requestAmount, requestCurrency)}
            style={[styles.moneyRequestPreviewBox, ...props.containerStyles, shouldDisableOnPress && styles.cursorDefault]}
        >
            {childContainer}
        </PressableWithFeedback>
    );
}

MoneyRequestPreview.propTypes = propTypes;
MoneyRequestPreview.defaultProps = defaultProps;
MoneyRequestPreview.displayName = 'MoneyRequestPreview';
MoneyRequestPreviewWrapper.propTypes = propTypes;
MoneyRequestPreviewWrapper.defaultProps = defaultProps;
MoneyRequestPreviewWrapper.displayName = 'MoneyRequestPreviewWrapper';

export default withOnyx({
    personalDetails: {
        key: ONYXKEYS.PERSONAL_DETAILS_LIST,
    },
    chatReport: {
        key: ({chatReportID}) => `${ONYXKEYS.COLLECTION.REPORT}${chatReportID}`,
    },
    iouReport: {
        key: ({iouReportID}) => `${ONYXKEYS.COLLECTION.REPORT}${iouReportID}`,
    },
    session: {
        key: ONYXKEYS.SESSION,
    },
    transaction: {
        key: ({action}) => `${ONYXKEYS.COLLECTION.TRANSACTION}${(action && action.originalMessage && action.originalMessage.IOUTransactionID) || 0}`,
    },
    walletTerms: {
        key: ONYXKEYS.WALLET_TERMS,
    },
    transactionViolations: {
        key: ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS,
    },
})(MoneyRequestPreviewWrapper);
