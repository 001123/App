import {useFocusEffect} from '@react-navigation/native';
import lodashGet from 'lodash/get';
import PropTypes from 'prop-types';
import React, {useCallback, useRef} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import FullPageNotFoundView from '@components/BlockingViews/FullPageNotFoundView';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import transactionPropTypes from '@components/transactionPropTypes';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import compose from '@libs/compose';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import * as IOUUtils from '@libs/IOUUtils';
import Navigation from '@libs/Navigation/Navigation';
import {iouDefaultProps, iouPropTypes} from '@pages/iou/propTypes';
import MoneyRequestAmountForm from '@pages/iou/steps/MoneyRequestAmountForm';
import reportPropTypes from '@pages/reportPropTypes';
import * as IOU from '@userActions/IOU';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import withFullTransactionOrNotFound from './withFullTransactionOrNotFound';
import withWritableReportOrNotFound from './withWritableReportOrNotFound';

const propTypes = {
    /** React Navigation route */
    route: PropTypes.shape({
        /** Params from the route */
        params: PropTypes.shape({
            /** The type of IOU report, i.e. bill, request, send */
            iouType: PropTypes.string,

            /** The report ID of the IOU */
            reportID: PropTypes.string,

            /** Selected currency from IOUCurrencySelection */
            currency: PropTypes.string,
        }),
    }).isRequired,

    /** Holds data related to Money Request view state, rather than the underlying Money Request data. */
    iou: iouPropTypes,

    transactionsDraft: PropTypes.shape({
        taxAmount: PropTypes.number,
    }),

    /* Onyx Props */
    /** The report that the transaction belongs to */
    report: reportPropTypes,

    /** The transaction object being modified in Onyx */
    transaction: transactionPropTypes,
};

const defaultProps = {
    iou: iouDefaultProps,
    transactionsDraft: {
        taxAmount: null,
    },
    report: {},
    transaction: {},
};

function IOURequestStepTaxAmountPage({
    route: {
        params: {iouType, reportID, transactionID, backTo, currency: selectedCurrency},
    },
    iou,
    transactionsDraft,
    transaction,
    transaction: {currency: originalCurrency},
    report,
}) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const textInput = useRef(null);
    const isEditing = Navigation.getActiveRoute().includes('taxAmount');

    const currency = selectedCurrency || originalCurrency;

    const focusTimeoutRef = useRef(null);
    useFocusEffect(
        useCallback(() => {
            focusTimeoutRef.current = setTimeout(() => textInput.current && textInput.current.focus(), CONST.ANIMATED_TRANSITION);
            return () => {
                if (!focusTimeoutRef.current) {
                    return;
                }
                clearTimeout(focusTimeoutRef.current);
            };
        }, []),
    );

    const navigateBack = () => {
        Navigation.goBack(isEditing ? ROUTES.MONEY_REQUEST_CONFIRMATION.getRoute(iouType, reportID) : ROUTES.HOME);
    };

    const navigateToCurrencySelectionPage = () => {
        // If the money request being created is a distance request, don't allow the user to choose the currency.
        // Only USD is allowed for distance requests.
        // Remove query from the route and encode it.
        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CURRENCY.getRoute(iouType, transactionID, reportID, backTo ? 'confirm' : '', Navigation.getActiveRouteWithoutParams()));
    };

    const updateTaxAmount = (currentAmount) => {
        const amountInSmallestCurrencyUnits = CurrencyUtils.convertToBackendAmount(Number.parseFloat(currentAmount));
        IOU.setMoneyRequestTaxAmount(transactionID, amountInSmallestCurrencyUnits);

        IOU.setMoneyRequestAmount_temporaryForRefactor(transactionID, amountInSmallestCurrencyUnits, currency || CONST.CURRENCY.USD);
        
        if (backTo) {
            Navigation.goBack(backTo);
            return;
        }

        // If a reportID exists in the report object, it's because the user started this flow from using the + button in the composer
        // inside a report. In this case, the participants can be automatically assigned from the report and the user can skip the participants step and go straight
        // to the confirm step.
        if (report.reportID) {
            IOU.setMoneyRequestParticipantsFromReport(transactionID, report);
            Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(iouType, transactionID, reportID));
            return;
        }

        // If there was no reportID, then that means the user started this flow from the global + menu
        // and an optimistic reportID was generated. In that case, the next step is to select the participants for this request.
        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_PARTICIPANTS.getRoute(iouType, transactionID, reportID));
    };

    const content = (
        <MoneyRequestAmountForm
            isEditing={isEditing}
            currency={currency}
            transactionAmount={transaction.amount}
            amount={transactionsDraft.taxAmount}
            ref={(e) => (textInput.current = e)}
            onCurrencyButtonPress={navigateToCurrencySelectionPage}
            onSubmitButtonPress={updateTaxAmount}
        />
    );

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableKeyboardAvoidingView={false}
            testID={IOURequestStepTaxAmountPage.displayName}
        >
            {({safeAreaPaddingBottomStyle}) => (
                <FullPageNotFoundView shouldShow={!IOUUtils.isValidMoneyRequestType(iouType)}>
                    <View style={[styles.flex1, safeAreaPaddingBottomStyle]}>
                        <HeaderWithBackButton
                            title={translate('iou.taxAmount')}
                            onBackButtonPress={navigateBack}
                        />
                        {content}
                    </View>
                </FullPageNotFoundView>
            )}
        </ScreenWrapper>
    );
}

IOURequestStepTaxAmountPage.propTypes = propTypes;
IOURequestStepTaxAmountPage.defaultProps = defaultProps;
IOURequestStepTaxAmountPage.displayName = 'IOURequestStepTaxAmountPage';
export default compose(
    withWritableReportOrNotFound,
    withFullTransactionOrNotFound,
    withOnyx({
        transactionsDraft: {
            key: ({transaction}) => `${ONYXKEYS.COLLECTION.TRANSACTION_DRAFT}${transaction.transactionID}`,
        },
    }),
)(IOURequestStepTaxAmountPage);
