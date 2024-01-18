import lodashGet from 'lodash/get';
import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useState} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import compose from '@libs/compose';
import * as HeaderUtils from '@libs/HeaderUtils';
import Navigation from '@libs/Navigation/Navigation';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import * as TransactionUtils from '@libs/TransactionUtils';
import reportActionPropTypes from '@pages/home/report/reportActionPropTypes';
import iouReportPropTypes from '@pages/iouReportPropTypes';
import * as IOU from '@userActions/IOU';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import ConfirmModal from './ConfirmModal';
import HeaderWithBackButton from './HeaderWithBackButton';
import HoldBanner from './HoldBanner';
import * as Expensicons from './Icon/Expensicons';
import MoneyRequestHeaderStatusBar from './MoneyRequestHeaderStatusBar';
import participantPropTypes from './participantPropTypes';
import ProcessMoneyRequestHoldMenu from './ProcessMoneyRequestHoldMenu';
import transactionPropTypes from './transactionPropTypes';

const propTypes = {
    /** The report currently being looked at */
    report: iouReportPropTypes.isRequired,

    /** The policy which the report is tied to */
    policy: PropTypes.shape({
        /** Name of the policy */
        name: PropTypes.string,
    }),

    /** Personal details so we can get the ones for the report participants */
    personalDetails: PropTypes.objectOf(participantPropTypes).isRequired,

    /* Onyx Props */
    /** Session info for the currently logged in user. */
    session: PropTypes.shape({
        /** Currently logged in user email */
        email: PropTypes.string,
    }),

    /** The expense report or iou report (only will have a value if this is a transaction thread) */
    parentReport: iouReportPropTypes,

    /** The report action the transaction is tied to from the parent report */
    parentReportAction: PropTypes.shape(reportActionPropTypes),

    /** All the data for the transaction */
    transaction: transactionPropTypes,

    shownHoldUseExplaination: PropTypes.bool,
};

const defaultProps = {
    session: {
        email: null,
    },
    parentReport: {},
    parentReportAction: {},
    transaction: {},
    shownHoldUseExplaination: true,
    policy: {},
};

function MoneyRequestHeader({session, parentReport, report, parentReportAction, transaction, shownHoldUseExplaination, policy, personalDetails}) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const moneyRequestReport = parentReport;
    const isSettled = ReportUtils.isSettled(moneyRequestReport.reportID);
    const isApproved = ReportUtils.isReportApproved(moneyRequestReport);
    const isOnHold = TransactionUtils.isOnHold(transaction);
    const {isSmallScreenWidth, windowWidth} = useWindowDimensions();

    // Only the requestor can take delete the request, admins can only edit it.
    const isActionOwner = lodashGet(parentReportAction, 'actorAccountID') === lodashGet(session, 'accountID', null);
    const isPolicyAdmin = lodashGet(policy, 'role') === CONST.POLICY.ROLE.ADMIN;
    const isApprover = ReportUtils.isMoneyRequestReport(moneyRequestReport) && lodashGet(session, 'accountID', null) === moneyRequestReport.managerID;

    const deleteTransaction = useCallback(() => {
        IOU.deleteMoneyRequest(lodashGet(parentReportAction, 'originalMessage.IOUTransactionID'), parentReportAction, true);
        setIsDeleteModalVisible(false);
    }, [parentReportAction, setIsDeleteModalVisible]);

    const isScanning = TransactionUtils.hasReceipt(transaction) && TransactionUtils.isReceiptBeingScanned(transaction);
    const isPending = TransactionUtils.isExpensifyCardTransaction(transaction) && TransactionUtils.isPending(transaction);

    const isRequestModifiable = !isSettled && !isApproved && !ReportActionsUtils.isDeletedAction(parentReportAction);
    const canModifyRequest = isActionOwner && isRequestModifiable;

    const changeMoneyRequestStatus = () => {
        if (!isOnHold) {
            const activeRoute = encodeURIComponent(Navigation.getActiveRouteWithoutParams());
            Navigation.navigate(
                ROUTES.MONEY_REQUEST_HOLD_REASON.getRoute(
                    lodashGet(policy, 'type'),
                    lodashGet(parentReportAction, 'originalMessage.IOUTransactionID'),
                    lodashGet(report, 'reportID'),
                    activeRoute,
                ),
            );
        } else {
            IOU.unholdRequest(lodashGet(parentReportAction, 'originalMessage.IOUTransactionID'), lodashGet(report, 'reportID'));
        }
    };

    useEffect(() => {
        if (canModifyRequest) {
            return;
        }

        setIsDeleteModalVisible(false);
    }, [canModifyRequest]);

    const threeDotsMenuItems = [HeaderUtils.getPinMenuItem(report)];
    if (isRequestModifiable) {
        const isHoldCreator = ReportUtils.isHoldCreator(transaction, lodashGet(report, 'reportID'));
        const isRequestIOU = lodashGet(parentReport, 'type') === 'iou';
        if (isOnHold && ((isRequestIOU && isHoldCreator) || (!isRequestIOU && (isPolicyAdmin || isActionOwner || isApprover)))) {
            threeDotsMenuItems.push({
                icon: Expensicons.Stopwatch,
                text: translate('iou.unholdRequest'),
                onSelected: () => changeMoneyRequestStatus(),
            });
        }
        if (!isOnHold && (isRequestIOU || isPolicyAdmin || isActionOwner || isApprover)) {
            threeDotsMenuItems.push({
                icon: Expensicons.Stopwatch,
                text: translate('iou.holdRequest'),
                onSelected: () => changeMoneyRequestStatus(),
            });
        }
    }

    const [shouldShowHoldMenu, setShouldShowHoldMenu] = useState(false);

    useEffect(() => {
        setShouldShowHoldMenu(isOnHold && !shownHoldUseExplaination);
    }, [isOnHold, shownHoldUseExplaination]);

    // eslint-disable-next-line rulesdir/prefer-early-return
    useEffect(() => {
        if (shouldShowHoldMenu) {
            if (isSmallScreenWidth) {
                if (Navigation.getActiveRoute().slice(1) === ROUTES.PROCESS_MONEY_REQUEST_HOLD) {
                    Navigation.goBack();
                }
            } else {
                Navigation.navigate(ROUTES.PROCESS_MONEY_REQUEST_HOLD);
            }
        }
    }, [isSmallScreenWidth, shouldShowHoldMenu]);

    const handleHoldRequestClose = () => {
        setShouldShowHoldMenu(false);
        IOU.setShownHoldUseExplaination();
    };

    if (canModifyRequest) {
        if (!TransactionUtils.hasReceipt(transaction)) {
            threeDotsMenuItems.push({
                icon: Expensicons.Receipt,
                text: translate('receipt.addReceipt'),
                onSelected: () =>
                    Navigation.navigate(
                        ROUTES.MONEY_REQUEST_STEP_SCAN.getRoute(
                            CONST.IOU.ACTION.EDIT,
                            CONST.IOU.TYPE.REQUEST,
                            transaction.transactionID,
                            report.reportID,
                            Navigation.getActiveRouteWithoutParams(),
                        ),
                    ),
            });
        }
        threeDotsMenuItems.push({
            icon: Expensicons.Trashcan,
            text: translate('reportActionContextMenu.deleteAction', {action: parentReportAction}),
            onSelected: () => setIsDeleteModalVisible(true),
        });
    }

    return (
        <>
            <View style={[styles.pl0]}>
                <HeaderWithBackButton
                    shouldShowBorderBottom={!isScanning && !isPending && !isOnHold}
                    shouldShowAvatarWithDisplay
                    shouldShowPinButton={false}
                    shouldShowThreeDotsButton
                    threeDotsMenuItems={threeDotsMenuItems}
                    threeDotsAnchorPosition={styles.threeDotsPopoverOffsetNoCloseButton(windowWidth)}
                    report={{
                        ...report,
                        ownerAccountID: lodashGet(parentReport, 'ownerAccountID', null),
                    }}
                    policy={policy}
                    personalDetails={personalDetails}
                    shouldShowBackButton={isSmallScreenWidth}
                    onBackButtonPress={() => Navigation.goBack(ROUTES.HOME, false, true)}
                />
                {isPending && (
                    <MoneyRequestHeaderStatusBar
                        title={translate('iou.pending')}
                        description={translate('iou.transactionPendingText')}
                        shouldShowBorderBottom={!isScanning}
                    />
                )}
                {isScanning && (
                    <MoneyRequestHeaderStatusBar
                        title={translate('iou.receiptStatusTitle')}
                        description={translate('iou.receiptStatusText')}
                        shouldShowBorderBottom
                    />
                )}
                {isOnHold && <HoldBanner />}
            </View>
            <ConfirmModal
                title={translate('iou.deleteRequest')}
                isVisible={isDeleteModalVisible}
                onConfirm={deleteTransaction}
                onCancel={() => setIsDeleteModalVisible(false)}
                prompt={translate('iou.deleteConfirmation')}
                confirmText={translate('common.delete')}
                cancelText={translate('common.cancel')}
                danger
            />
            {isSmallScreenWidth && shouldShowHoldMenu && (
                <ProcessMoneyRequestHoldMenu
                    onClose={handleHoldRequestClose}
                    onConfirm={handleHoldRequestClose}
                    isVisible={shouldShowHoldMenu}
                />
            )}
        </>
    );
}

MoneyRequestHeader.displayName = 'MoneyRequestHeader';
MoneyRequestHeader.propTypes = propTypes;
MoneyRequestHeader.defaultProps = defaultProps;

export default compose(
    withOnyx({
        session: {
            key: ONYXKEYS.SESSION,
        },
        parentReport: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.REPORT}${report.parentReportID}`,
        },
        parentReportActions: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report ? report.parentReportID : '0'}`,
            canEvict: false,
        },
    }),
    // eslint-disable-next-line rulesdir/no-multiple-onyx-in-file
    withOnyx({
        transaction: {
            key: ({report, parentReportActions}) => {
                const parentReportAction = lodashGet(parentReportActions, [report.parentReportActionID]);
                return `${ONYXKEYS.COLLECTION.TRANSACTION}${lodashGet(parentReportAction, 'originalMessage.IOUTransactionID', 0)}`;
            },
        },
        shownHoldUseExplaination: {
            key: ONYXKEYS.NVP_HOLD_USE_EXPLAINED,
            initWithStoredValues: false,
        },
    }),
)(MoneyRequestHeader);
