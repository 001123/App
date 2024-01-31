import lodashGet from 'lodash/get';
import lodashValues from 'lodash/values';
import PropTypes from 'prop-types';
import React, {useCallback, useEffect} from 'react';
import {withOnyx} from 'react-native-onyx';
import FullPageNotFoundView from '@components/BlockingViews/FullPageNotFoundView';
import categoryPropTypes from '@components/categoryPropTypes';
import ScreenWrapper from '@components/ScreenWrapper';
import tagPropTypes from '@components/tagPropTypes';
import taxPropTypes from '@components/taxPropTypes';
import transactionPropTypes from '@components/transactionPropTypes';
import compose from '@libs/compose';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import Navigation from '@libs/Navigation/Navigation';
import * as OptionsListUtils from '@libs/OptionsListUtils';
import * as PolicyUtils from '@libs/PolicyUtils';
import {isTaxPolicyEnabled} from '@libs/PolicyUtils';
import * as ReportUtils from '@libs/ReportUtils';
import * as TransactionUtils from '@libs/TransactionUtils';
import * as IOU from '@userActions/IOU';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import EditRequestAmountPage from './EditRequestAmountPage';
import EditRequestCategoryPage from './EditRequestCategoryPage';
import EditRequestCreatedPage from './EditRequestCreatedPage';
import EditRequestDescriptionPage from './EditRequestDescriptionPage';
import EditRequestDistancePage from './EditRequestDistancePage';
import EditRequestMerchantPage from './EditRequestMerchantPage';
import EditRequestReceiptPage from './EditRequestReceiptPage';
import EditRequestTagPage from './EditRequestTagPage';
import EditRequestTaxAmountPage from './EditRequestTaxAmountPage';
import EditRequestTaxRatePage from './EditRequestTaxRatePage';
import reportActionPropTypes from './home/report/reportActionPropTypes';
import reportPropTypes from './reportPropTypes';

const propTypes = {
    /** Route from navigation */
    route: PropTypes.shape({
        /** Params from the route */
        params: PropTypes.shape({
            /** Which field we are editing */
            field: PropTypes.string,

            /** reportID for the "transaction thread" */
            threadReportID: PropTypes.string,
        }),
    }).isRequired,

    /** Onyx props */
    /** The report object for the thread report */
    report: reportPropTypes,

    /** Collection of categories attached to a policy */
    policyCategories: PropTypes.objectOf(categoryPropTypes),

    /** Collection of tags attached to a policy */
    policyTags: tagPropTypes,

    /** The actions from the parent report */
    parentReportActions: PropTypes.objectOf(PropTypes.shape(reportActionPropTypes)),

    /** Transaction that stores the request data */
    transaction: transactionPropTypes,
    /* Onyx Props */
    /** The policy of the report */
    policy: PropTypes.shape({
        /** Is Tax tracking Enabled */
        isTaxTrackingEnabled: PropTypes.bool,
    }),

    /** Collection of tax rates attached to a policy */
    policyTaxRates: taxPropTypes,
};

const defaultProps = {
    report: {},
    policyCategories: {},
    policyTags: {},
    parentReportActions: {},
    transaction: {},
    policy: {},
    policyTaxRates: {},
};
const getTaxAmount = (transactionAmount, transactionTaxCode, policyTaxRates) => {
    const percentage = (transactionTaxCode ? policyTaxRates.taxes[transactionTaxCode].value : policyTaxRates.defaultValue) || '';
    return CurrencyUtils.convertToBackendAmount(Number.parseFloat(TransactionUtils.calculateTaxAmount(percentage, transactionAmount)));
};
function EditRequestPage({report, policy, policyTaxRates, route, policyCategories, policyTags, parentReportActions, transaction}) {
    const parentReportActionID = lodashGet(report, 'parentReportActionID', '0');
    const parentReportAction = lodashGet(parentReportActions, parentReportActionID, {});
    const {
        amount: transactionAmount,
        taxAmount: transactionTaxAmount,
        taxCode: transactionTaxCode,
        currency: transactionCurrency,
        comment: transactionDescription,
        merchant: transactionMerchant,
        category: transactionCategory,
        tag: transactionTag,
    } = ReportUtils.getTransactionDetails(transaction);

    const defaultCurrency = lodashGet(route, 'params.currency', '') || transactionCurrency;
    const fieldToEdit = lodashGet(route, ['params', 'field'], '');

    const taxRateTitle = TransactionUtils.getTaxName(policyTaxRates.taxes, transactionTaxCode);

    // For now, it always defaults to the first tag of the policy
    const policyTag = PolicyUtils.getTag(policyTags);
    const policyTagList = lodashGet(policyTag, 'tags', {});
    const tagListName = PolicyUtils.getTagListName(policyTags);

    // A flag for verifying that the current report is a sub-report of a workspace chat
    const isPolicyExpenseChat = ReportUtils.isGroupPolicy(report);

    // A flag for showing the categories page
    const shouldShowCategories = isPolicyExpenseChat && (transactionCategory || OptionsListUtils.hasEnabledOptions(lodashValues(policyCategories)));

    // A flag for showing the tags page
    const shouldShowTags = isPolicyExpenseChat && (transactionTag || OptionsListUtils.hasEnabledOptions(lodashValues(policyTagList)));

    // A flag for showing tax rate
    const shouldShowTax = isTaxPolicyEnabled(isPolicyExpenseChat, policy);

    // Decides whether to allow or disallow editing a money request
    useEffect(() => {
        // Do not dismiss the modal, when a current user can edit this property of the money request.
        if (ReportUtils.canEditFieldOfMoneyRequest(parentReportAction, fieldToEdit)) {
            return;
        }

        // Dismiss the modal when a current user cannot edit a money request.
        Navigation.isNavigationReady().then(() => {
            Navigation.dismissModal();
        });
    }, [parentReportAction, fieldToEdit]);

    const updateTaxAmount = (transactionChanges) => {
        const newTaxAmount = CurrencyUtils.convertToBackendAmount(Number.parseFloat(transactionChanges.amount));
        IOU.updateMoneyRequestTaxAmount(transaction.transactionID, report.reportID, newTaxAmount);
        Navigation.dismissModal(report.reportID);
    };

    const updateTaxRate = (transactionChanges) => {
        const newTaxCode = transactionChanges.data.code;
        IOU.updateMoneyRequestTaxRate(transaction.transactionID, report.reportID, newTaxCode);
        Navigation.dismissModal(report.reportID);
    };

    const saveAmountAndCurrency = useCallback(
        ({amount, currency: newCurrency}) => {
            const newAmount = CurrencyUtils.convertToBackendAmount(Number.parseFloat(amount));

            // If the value hasn't changed, don't request to save changes on the server and just close the modal
            if (newAmount === TransactionUtils.getAmount(transaction) && newCurrency === TransactionUtils.getCurrency(transaction)) {
                Navigation.dismissModal();
                return;
            }

            IOU.updateMoneyRequestAmountAndCurrency(transaction.transactionID, report.reportID, newCurrency, newAmount);
            Navigation.dismissModal();
        },
        [transaction, report],
    );

    const saveCreated = useCallback(
        ({created: newCreated}) => {
            // If the value hasn't changed, don't request to save changes on the server and just close the modal
            if (newCreated === TransactionUtils.getCreated(transaction)) {
                Navigation.dismissModal();
                return;
            }
            IOU.updateMoneyRequestDate(transaction.transactionID, report.reportID, newCreated);
            Navigation.dismissModal();
        },
        [transaction, report],
    );

    const saveMerchant = useCallback(
        ({merchant: newMerchant}) => {
            const newTrimmedMerchant = newMerchant.trim();

            // In case the merchant hasn't been changed, do not make the API request.
            // In case the merchant has been set to empty string while current merchant is partial, do nothing too.
            if (newTrimmedMerchant === transactionMerchant || (newTrimmedMerchant === '' && transactionMerchant === CONST.TRANSACTION.PARTIAL_TRANSACTION_MERCHANT)) {
                Navigation.dismissModal();
                return;
            }

            // An empty newTrimmedMerchant is only possible for the P2P IOU case
            IOU.updateMoneyRequestMerchant(transaction.transactionID, report.reportID, newTrimmedMerchant || CONST.TRANSACTION.PARTIAL_TRANSACTION_MERCHANT);
            Navigation.dismissModal();
        },
        [transactionMerchant, transaction, report],
    );

    const saveTag = useCallback(
        ({tag: newTag}) => {
            let updatedTag = newTag;
            if (newTag === transactionTag) {
                // In case the same tag has been selected, reset the tag.
                updatedTag = '';
            }
            IOU.updateMoneyRequestTag(transaction.transactionID, report.reportID, updatedTag);
            Navigation.dismissModal();
        },
        [transactionTag, transaction.transactionID, report.reportID],
    );

    const saveCategory = useCallback(
        ({category: newCategory}) => {
            // In case the same category has been selected, reset the category.
            const updatedCategory = newCategory === transactionCategory ? '' : newCategory;
            IOU.updateMoneyRequestCategory(transaction.transactionID, report.reportID, updatedCategory);
            Navigation.dismissModal();
        },
        [transactionCategory, transaction.transactionID, report.reportID],
    );

    const saveComment = useCallback(
        ({comment: newComment}) => {
            // Only update comment if it has changed
            if (newComment.trim() !== transactionDescription) {
                IOU.updateMoneyRequestDescription(transaction.transactionID, report.reportID, newComment.trim());
            }
            Navigation.dismissModal();
        },
        [transactionDescription, transaction.transactionID, report.reportID],
    );

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.DESCRIPTION) {
        return (
            <EditRequestDescriptionPage
                defaultDescription={transactionDescription}
                onSubmit={saveComment}
            />
        );
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.DATE) {
        return (
            <EditRequestCreatedPage
                defaultCreated={TransactionUtils.getCreated(transaction)}
                onSubmit={saveCreated}
            />
        );
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.AMOUNT) {
        return (
            <EditRequestAmountPage
                defaultAmount={transactionAmount}
                defaultCurrency={defaultCurrency}
                reportID={report.reportID}
                onSubmit={saveAmountAndCurrency}
                onNavigateToCurrency={() => {
                    const activeRoute = encodeURIComponent(Navigation.getActiveRouteWithoutParams());
                    Navigation.navigate(ROUTES.EDIT_CURRENCY_REQUEST.getRoute(report.reportID, defaultCurrency, activeRoute));
                }}
            />
        );
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.MERCHANT) {
        return (
            <EditRequestMerchantPage
                defaultMerchant={transactionMerchant}
                isPolicyExpenseChat={isPolicyExpenseChat}
                onSubmit={saveMerchant}
            />
        );
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.CATEGORY && shouldShowCategories) {
        return (
            <EditRequestCategoryPage
                defaultCategory={transactionCategory}
                policyID={lodashGet(report, 'policyID', '')}
                onSubmit={saveCategory}
            />
        );
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.TAG && shouldShowTags) {
        return (
            <EditRequestTagPage
                defaultTag={transactionTag}
                tagName={tagListName}
                policyID={lodashGet(report, 'policyID', '')}
                onSubmit={saveTag}
            />
        );
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.TAX_AMOUNT && shouldShowTax) {
        return (
            <EditRequestTaxAmountPage
                defaultAmount={transactionTaxAmount}
                defaultTaxAmount={getTaxAmount(transactionAmount, transactionTaxCode, policyTaxRates)}
                defaultCurrency={defaultCurrency}
                onNavigateToCurrency={() => {
                    const activeRoute = encodeURIComponent(Navigation.getActiveRouteWithoutParams());
                    Navigation.navigate(ROUTES.EDIT_CURRENCY_REQUEST.getRoute(report.reportID, defaultCurrency, activeRoute));
                }}
                onSubmit={updateTaxAmount}
            />
        );
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.TAX_RATE && shouldShowTax) {
        return (
            <EditRequestTaxRatePage
                defaultTaxRate={taxRateTitle}
                policyID={lodashGet(report, 'policyID', '')}
                onSubmit={updateTaxRate}
            />
        );
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.RECEIPT) {
        return (
            <EditRequestReceiptPage
                route={route}
                transactionID={transaction.transactionID}
            />
        );
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.DISTANCE) {
        return (
            <EditRequestDistancePage
                report={report}
                transactionID={transaction.transactionID}
                route={route}
            />
        );
    }

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
            testID={EditRequestPage.displayName}
        >
            <FullPageNotFoundView shouldShow />
        </ScreenWrapper>
    );
}

EditRequestPage.displayName = 'EditRequestPage';
EditRequestPage.propTypes = propTypes;
EditRequestPage.defaultProps = defaultProps;
export default compose(
    withOnyx({
        report: {
            key: ({route}) => `${ONYXKEYS.COLLECTION.REPORT}${route.params.threadReportID}`,
        },
    }),
    // eslint-disable-next-line rulesdir/no-multiple-onyx-in-file
    withOnyx({
        policyCategories: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${report ? report.policyID : '0'}`,
        },
        policy: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.POLICY}${report.policyID}`,
        },
        policyTags: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.POLICY_TAGS}${report ? report.policyID : '0'}`,
        },
        policyTaxRates: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.POLICY_TAX_RATE}${report.policyID}`,
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
                const parentReportActionID = lodashGet(report, 'parentReportActionID', '0');
                const parentReportAction = lodashGet(parentReportActions, parentReportActionID);
                return `${ONYXKEYS.COLLECTION.TRANSACTION}${lodashGet(parentReportAction, 'originalMessage.IOUTransactionID', 0)}`;
            },
        },
    }),
)(EditRequestPage);
