import React, {useEffect, useState, useRef, useCallback} from 'react';
import _ from 'underscore';
import {withOnyx} from 'react-native-onyx';
import {Dimensions} from 'react-native';
import lodashGet from 'lodash/get';
import CONST from '../../CONST';
import Navigation from '../../libs/Navigation/Navigation';
import AddPaymentMethodMenu from '../AddPaymentMethodMenu';
import getClickedTargetLocation from '../../libs/getClickedTargetLocation';
import * as PaymentUtils from '../../libs/PaymentUtils';
import * as PaymentMethods from '../../libs/actions/PaymentMethods';
import ONYXKEYS from '../../ONYXKEYS';
import Log from '../../libs/Log';
import {propTypes, defaultProps} from './kycWallPropTypes';
import * as Wallet from '../../libs/actions/Wallet';
import * as ReportUtils from '../../libs/ReportUtils';

const POPOVER_MENU_ANCHOR_POSITION_HORIZONTAL_OFFSET = 20;

// This component allows us to block various actions by forcing the user to first add a default payment method and successfully make it through our Know Your Customer flow
// before continuing to take whatever action they originally intended to take. It requires a button as a child and a native event so we can get the coordinates and use it
// to render the AddPaymentMethodMenu in the correct location.
function KYCWall({
    addBankAccountRoute,
    addDebitCardRoute,
    anchorAlignment,
    bankAccountList,
    chatReportID,
    children,
    enablePaymentsRoute,
    fundList,
    iouReport,
    onSelectPaymentMethod,
    onSuccessfulKYC,
    reimbursementAccount,
    shouldIncludeDebitCard,
    shouldListenForResize,
    source,
    userWallet,
    walletTerms,
}) {
    const anchorRef = useRef(null);
    const transferBalanceButtonRef = useRef(null);

    const [shouldShowAddPaymentMenu, setShouldShowAddPaymentMenu] = useState(false);
    const [anchorPosition, setAnchorPosition] = useState({
        anchorPositionVertical: 0,
        anchorPositionHorizontal: 0,
    });

    /**
     * @param {DOMRect} domRect
     * @returns {Object}
     */
    const getAnchorPosition = useCallback(
        (domRect) => {
            if (anchorAlignment.vertical === CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP) {
                return {
                    anchorPositionVertical: domRect.top + domRect.height + CONST.MODAL.POPOVER_MENU_PADDING,
                    anchorPositionHorizontal: domRect.left + POPOVER_MENU_ANCHOR_POSITION_HORIZONTAL_OFFSET,
                };
            }

            return {
                anchorPositionVertical: domRect.top - CONST.MODAL.POPOVER_MENU_PADDING,
                anchorPositionHorizontal: domRect.left,
            };
        },
        [anchorAlignment.vertical],
    );

    /**
     * Set position of the transfer payment menu
     *
     * @param {Object} position
     */
    const setPositionAddPaymentMenu = ({anchorPositionVertical, anchorPositionHorizontal}) => {
        setAnchorPosition({
            anchorPositionVertical,
            anchorPositionHorizontal,
        });
    };

    const setMenuPosition = useCallback(() => {
        if (!transferBalanceButtonRef.current) {
            return;
        }
        const buttonPosition = getClickedTargetLocation(transferBalanceButtonRef.current);
        const position = getAnchorPosition(buttonPosition);

        setPositionAddPaymentMenu(position);
    }, [getAnchorPosition]);

    useEffect(() => {
        let dimensionsSubscription = null;

        PaymentMethods.kycWallRef.current = this;

        if (shouldListenForResize) {
            dimensionsSubscription = Dimensions.addEventListener('change', setMenuPosition);
        }

        Wallet.setKYCWallSourceChatReportID(chatReportID);

        return () => {
            if (shouldListenForResize && dimensionsSubscription) {
                dimensionsSubscription.remove();
            }

            PaymentMethods.kycWallRef.current = null;
        };
    }, [chatReportID, setMenuPosition, shouldListenForResize]);

    /**
     * @param {String} paymentMethod
     */
    const selectPaymentMethod = (paymentMethod) => {
        onSelectPaymentMethod(paymentMethod);

        if (paymentMethod === CONST.PAYMENT_METHODS.BANK_ACCOUNT) {
            Navigation.navigate(addBankAccountRoute);
        } else if (paymentMethod === CONST.PAYMENT_METHODS.DEBIT_CARD) {
            Navigation.navigate(addDebitCardRoute);
        }
    };

    /**
     * Take the position of the button that calls this method and show the Add Payment method menu when the user has no valid payment method.
     * If they do have a valid payment method they are navigated to the "enable payments" route to complete KYC checks.
     * If they are already KYC'd we will continue whatever action is gated behind the KYC wall.
     *
     * @param {Event} event
     * @param {String} iouPaymentType
     */
    const continueAction = (event, iouPaymentType) => {
        const currentSource = lodashGet(walletTerms, 'source', source);

        /**
         * Set the source, so we can tailor the process according to how we got here.
         * We do not want to set this on mount, as the source can change upon completing the flow, e.g. when upgrading the wallet to Gold.
         */
        Wallet.setKYCWallSource(source, chatReportID);

        if (shouldShowAddPaymentMenu) {
            setShouldShowAddPaymentMenu(false);

            return;
        }

        // Use event target as fallback if anchorRef is null for safety
        const targetElement = anchorRef.current || event.nativeEvent.target;

        transferBalanceButtonRef.current = targetElement;
        const isExpenseReport = ReportUtils.isExpenseReport(iouReport);
        const paymentCardList = fundList || {};

        // Check to see if user has a valid payment method on file and display the add payment popover if they don't
        if (
            (isExpenseReport && lodashGet(reimbursementAccount, 'achData.state', '') !== CONST.BANK_ACCOUNT.STATE.OPEN) ||
            (!isExpenseReport && !PaymentUtils.hasExpensifyPaymentMethod(paymentCardList, bankAccountList, shouldIncludeDebitCard))
        ) {
            Log.info('[KYC Wallet] User does not have valid payment method');
            if (!shouldIncludeDebitCard) {
                selectPaymentMethod(CONST.PAYMENT_METHODS.BANK_ACCOUNT);
                return;
            }

            const clickedElementLocation = getClickedTargetLocation(targetElement);
            const position = getAnchorPosition(clickedElementLocation);

            setPositionAddPaymentMenu(position);
            setShouldShowAddPaymentMenu(true);

            return;
        }

        if (!isExpenseReport) {
            // Ask the user to upgrade to a gold wallet as this means they have not yet gone through our Know Your Customer (KYC) checks
            const hasActivatedWallet = userWallet.tierName && _.contains([CONST.WALLET.TIER_NAME.GOLD, CONST.WALLET.TIER_NAME.PLATINUM], userWallet.tierName);
            if (!hasActivatedWallet) {
                Log.info('[KYC Wallet] User does not have active wallet');
                Navigation.navigate(enablePaymentsRoute);
                return;
            }
        }

        Log.info('[KYC Wallet] User has valid payment method and passed KYC checks or did not need them');
        onSuccessfulKYC(iouPaymentType, currentSource);
    };

    return (
        <>
            <AddPaymentMethodMenu
                isVisible={shouldShowAddPaymentMenu}
                onClose={() => setShouldShowAddPaymentMenu(false)}
                anchorRef={anchorRef}
                anchorAlignment={anchorAlignment}
                anchorPosition={{
                    vertical: anchorPosition.anchorPositionVertical,
                    horizontal: anchorPosition.anchorPositionHorizontal,
                }}
                onItemSelected={(item) => {
                    setShouldShowAddPaymentMenu(false);
                    selectPaymentMethod(item);
                }}
            />
            {children(continueAction, anchorRef)}
        </>
    );
}

KYCWall.propTypes = propTypes;
KYCWall.defaultProps = defaultProps;
KYCWall.displayName = 'BaseKYCWall';

export default withOnyx({
    userWallet: {
        key: ONYXKEYS.USER_WALLET,
    },
    walletTerms: {
        key: ONYXKEYS.WALLET_TERMS,
    },
    fundList: {
        key: ONYXKEYS.FUND_LIST,
    },
    bankAccountList: {
        key: ONYXKEYS.BANK_ACCOUNT_LIST,
    },
    reimbursementAccount: {
        key: ONYXKEYS.REIMBURSEMENT_ACCOUNT,
    },
    chatReport: {
        key: ({chatReportID}) => `${ONYXKEYS.COLLECTION.REPORT}${chatReportID}`,
    },
})(KYCWall);
