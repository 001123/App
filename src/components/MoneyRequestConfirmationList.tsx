import {useIsFocused} from '@react-navigation/native';
import {format} from 'date-fns';
import {isEmpty} from 'lodash';
import React, {useCallback, useEffect, useMemo, useReducer, useState} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import {withOnyx} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import useLocalize from '@hooks/useLocalize';
import usePermissions from '@hooks/usePermissions';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import DistanceRequestUtils from '@libs/DistanceRequestUtils';
import * as IOUUtils from '@libs/IOUUtils';
import Log from '@libs/Log';
import * as MoneyRequestUtils from '@libs/MoneyRequestUtils';
import Navigation from '@libs/Navigation/Navigation';
import * as OptionsListUtils from '@libs/OptionsListUtils';
import * as PolicyUtils from '@libs/PolicyUtils';
import * as ReceiptUtils from '@libs/ReceiptUtils';
import * as ReportUtils from '@libs/ReportUtils';
import type {Participant} from '@libs/ReportUtils';
import * as TransactionUtils from '@libs/TransactionUtils';
import * as IOU from '@userActions/IOU';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type * as OnyxTypes from '@src/types/onyx';
import type {MileageRate} from '@src/types/onyx/Policy';
import ButtonWithDropdownMenu from './ButtonWithDropdownMenu';
import ConfirmedRoute from './ConfirmedRoute';
import FormHelpMessage from './FormHelpMessage';
import Image from './Image';
import MenuItemWithTopDescription from './MenuItemWithTopDescription';
import OptionsSelector from './OptionsSelector';
import SettlementButton from './SettlementButton';
import ShowMoreButton from './ShowMoreButton';
import Switch from './Switch';
import Text from './Text';
import type {WithCurrentUserPersonalDetailsProps} from './withCurrentUserPersonalDetails';
import withCurrentUserPersonalDetails from './withCurrentUserPersonalDetails';

type MoneyRequestConfirmationListOnyxProps = {
    iou: OnyxEntry<OnyxTypes.IOU>;
    policyTaxRates: OnyxEntry<OnyxTypes.PolicyTaxRate>;
    mileageRate: OnyxEntry<MileageRate>;
    policyCategories: OnyxEntry<OnyxTypes.PolicyCategories>;
    policyTags: OnyxEntry<OnyxTypes.PolicyTags>;
    policy: OnyxEntry<OnyxTypes.Policy>;
};

type MoneyRequestConfirmationListProps = MoneyRequestConfirmationListOnyxProps &
    WithCurrentUserPersonalDetailsProps & {
        /** Callback to inform parent modal of success */
        onConfirm?: (selectedParticipants: Participant[]) => void;

        /** Callback to parent modal to send money */
        onSendMoney?: (paymentMethod: ValueOf<typeof CONST.IOU.PAYMENT_TYPE>) => void;

        /** Callback to inform a participant is selected */
        onSelectParticipant?: (option: Participant) => void;

        /** Should we request a single or multiple participant selection from user */
        hasMultipleParticipants: boolean;

        /** IOU amount */
        iouAmount: number;

        /** IOU comment */
        iouComment?: string;

        /** IOU currency */
        iouCurrencyCode?: string;

        /** IOU type */
        iouType?: ValueOf<typeof CONST.IOU.TYPE>;

        /** IOU date */
        iouCreated?: string;

        /** IOU merchant */
        iouMerchant?: string;

        /** IOU Category */
        iouCategory?: string;

        /** IOU Tag */
        iouTag?: string;

        /** IOU isBillable */
        iouIsBillable?: boolean;

        /** Callback to toggle the billable state */
        onToggleBillable?: () => void;

        /** Selected participants from MoneyRequestModal with login / accountID */
        selectedParticipants: Participant[];

        /** Payee of the money request with login */
        payeePersonalDetails?: OnyxEntry<OnyxTypes.PersonalDetails>;

        /** Can the participants be modified or not */
        canModifyParticipants?: boolean;

        /** Should the list be read only, and not editable? */
        isReadOnly?: boolean;

        /** Depending on expense report or personal IOU report, respective bank account route */
        bankAccountRoute?: string;

        /** The policyID of the request */
        policyID?: string;

        /** The reportID of the request */
        reportID?: string;

        /** File path of the receipt */
        receiptPath?: string;

        /** File name of the receipt */
        receiptFilename?: string;

        /** List styles for OptionsSelector */
        listStyles?: StyleProp<ViewStyle>;

        /** ID of the transaction that represents the money request */
        transactionID?: string;

        /** Whether the money request is a distance request */
        isDistanceRequest?: boolean;

        /** Whether the money request is a scan request */
        isScanRequest?: boolean;

        /** Whether we're editing a split bill */
        isEditingSplitBill?: boolean;

        /** Whether we should show the amount, date, and merchant fields. */
        shouldShowSmartScanFields?: boolean;

        /** A flag for verifying that the current report is a sub-report of a workspace chat */
        isPolicyExpenseChat?: boolean;

        hasSmartScanFailed?: boolean;

        reportActionID?: string;

        transaction: OnyxTypes.Transaction;
    };

function MoneyRequestConfirmationList({
    onConfirm = () => {},
    onSendMoney = () => {},
    onSelectParticipant = () => {},
    iouType = CONST.IOU.TYPE.REQUEST,
    iouCategory = '',
    iouTag = '',
    iouIsBillable = false,
    onToggleBillable = () => {},
    payeePersonalDetails = null,
    canModifyParticipants = false,
    isReadOnly = false,
    bankAccountRoute = '',
    policyID = '',
    reportID = '',
    receiptPath = '',
    receiptFilename = '',
    transactionID = '',
    mileageRate = {unit: CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES, rate: 0, currency: 'USD'},
    isDistanceRequest = false,
    isScanRequest = false,
    shouldShowSmartScanFields = true,
    isPolicyExpenseChat = false,
    transaction,
    iouAmount,
    policyTags,
    policyCategories,
    policy,
    policyTaxRates,
    iouCurrencyCode,
    isEditingSplitBill,
    hasSmartScanFailed,
    iouMerchant,
    currentUserPersonalDetails,
    hasMultipleParticipants,
    selectedParticipants,
    session,
    iou,
    reportActionID,
    iouCreated,
    listStyles,
    iouComment,
}: MoneyRequestConfirmationListProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate, toLocaleDigit} = useLocalize();
    const {canUseViolations} = usePermissions();

    const isTypeRequest = iouType === CONST.IOU.TYPE.REQUEST;
    const isSplitBill = iouType === CONST.IOU.TYPE.SPLIT;
    const isTypeSend = iouType === CONST.IOU.TYPE.SEND;

    const isSplitWithScan = isSplitBill && isScanRequest;

    const distance = transaction?.routes?.route0.distance ?? 0;
    const shouldCalculateDistanceAmount = isDistanceRequest && iouAmount === 0;

    // A flag for showing the categories field
    const shouldShowCategories = isPolicyExpenseChat && (iouCategory || OptionsListUtils.hasEnabledOptions(Object.values(policyCategories ?? {})));

    // A flag and a toggler for showing the rest of the form fields
    const [shouldExpandFields, toggleShouldExpandFields] = useReducer((state) => !state, false);

    // Do not hide fields in case of send money request
    const shouldShowAllFields = isDistanceRequest || shouldExpandFields || !shouldShowSmartScanFields || isTypeSend || isEditingSplitBill;

    // In Send Money and Split Bill with Scan flow, we don't allow the Merchant or Date to be edited. For distance requests, don't show the merchant as there's already another "Distance" menu item
    const shouldShowDate = shouldShowAllFields && !isTypeSend && !isSplitWithScan;
    const shouldShowMerchant = shouldShowAllFields && !isTypeSend && !isDistanceRequest && !isSplitWithScan;

    // Fetches the first tag list of the policy
    const policyTag = PolicyUtils.getTag(policyTags);
    const policyTagList = policyTag?.tags ?? {};
    const policyTagListName = policyTag?.name ?? translate('common.tag');
    // A flag for showing the tags field
    const shouldShowTags = isPolicyExpenseChat && (iouTag || OptionsListUtils.hasEnabledOptions(Object.values(policyTagList)));

    // A flag for showing tax fields - tax rate and tax amount
    const shouldShowTax = isPolicyExpenseChat && policy?.isTaxTrackingEnabled;

    // A flag for showing the billable field
    const shouldShowBillable = !policy?.disabledFields?.defaultBillable ?? true;

    const hasRoute = TransactionUtils.hasRoute(transaction);
    const isDistanceRequestWithoutRoute = isDistanceRequest && !hasRoute;
    const formattedAmount = isDistanceRequestWithoutRoute
        ? translate('common.tbd')
        : CurrencyUtils.convertToDisplayString(
              shouldCalculateDistanceAmount
                  ? DistanceRequestUtils.getDistanceRequestAmount(distance, mileageRate?.unit ?? CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES, mileageRate?.rate ?? 0)
                  : iouAmount,
              isDistanceRequest ? mileageRate?.currency : iouCurrencyCode,
          );
    const formattedTaxAmount = CurrencyUtils.convertToDisplayString(transaction?.taxAmount, iouCurrencyCode);

    const defaultTaxKey = policyTaxRates?.defaultExternalID;
    const defaultTaxName = (defaultTaxKey && `${policyTaxRates.taxes[defaultTaxKey].name} (${policyTaxRates?.taxes[defaultTaxKey].value}) • ${translate('common.default')}`) ?? '';
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const taxRateTitle = transaction?.taxRate?.text || defaultTaxName;

    const isFocused = useIsFocused();
    const [formError, setFormError] = useState<TranslationPaths | null>(null);

    const [didConfirm, setDidConfirm] = useState(false);
    const [didConfirmSplit, setDidConfirmSplit] = useState(false);

    const shouldDisplayFieldError = useMemo(() => {
        if (!isEditingSplitBill) {
            return false;
        }

        return (!!hasSmartScanFailed && TransactionUtils.hasMissingSmartscanFields(transaction)) || (didConfirmSplit && TransactionUtils.areRequiredFieldsEmpty(transaction));
    }, [isEditingSplitBill, hasSmartScanFailed, transaction, didConfirmSplit]);

    const isMerchantEmpty = !iouMerchant || iouMerchant === CONST.TRANSACTION.PARTIAL_TRANSACTION_MERCHANT;
    const shouldDisplayMerchantError = isPolicyExpenseChat && !isScanRequest && isMerchantEmpty;

    useEffect(() => {
        if (shouldDisplayFieldError && hasSmartScanFailed) {
            setFormError('iou.receiptScanningFailed');
            return;
        }
        if (shouldDisplayFieldError && didConfirmSplit) {
            setFormError('iou.error.genericSmartscanFailureMessage');
            return;
        }
        // reset the form error whenever the screen gains or loses focus
        setFormError(null);
    }, [isFocused, transaction, shouldDisplayFieldError, hasSmartScanFailed, didConfirmSplit]);

    useEffect(() => {
        if (!shouldCalculateDistanceAmount) {
            return;
        }

        const amount = DistanceRequestUtils.getDistanceRequestAmount(distance, mileageRate?.unit ?? CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES, mileageRate?.rate ?? 0);
        IOU.setMoneyRequestAmount(amount);
    }, [shouldCalculateDistanceAmount, distance, mileageRate?.rate, mileageRate?.unit]);

    /**
     * Returns the participants with amount
     */
    const getParticipantsWithAmount = useCallback(
        (participantsList: Participant[]) => {
            const calculatedIouAmount = IOUUtils.calculateAmount(participantsList.length, iouAmount, iouCurrencyCode ?? '');
            return OptionsListUtils.getIOUConfirmationOptionsFromParticipants(
                participantsList,
                calculatedIouAmount > 0 ? CurrencyUtils.convertToDisplayString(calculatedIouAmount, iouCurrencyCode) : '',
                // TODO: Remove assertion after OptionsListUtils will be migrated
            ) as Participant[];
        },
        [iouAmount, iouCurrencyCode],
    );

    // If completing a split bill fails, set didConfirm to false to allow the user to edit the fields again
    if (isEditingSplitBill && didConfirm) {
        setDidConfirm(false);
    }

    const splitOrRequestOptions = useMemo(() => {
        let text;
        if (isSplitBill && iouAmount === 0) {
            text = translate('iou.split');
        } else if ((receiptPath && isTypeRequest) || isDistanceRequestWithoutRoute) {
            text = translate('iou.request');
            if (iouAmount !== 0) {
                text = translate('iou.requestAmount', {amount: Number(formattedAmount)});
            }
        } else {
            const translationKey = isSplitBill ? 'iou.splitAmount' : 'iou.requestAmount';
            text = translate(translationKey, {amount: Number(formattedAmount)});
        }
        return [
            {
                text: text[0].toUpperCase() + text.slice(1),
                value: iouType,
            },
        ];
    }, [isSplitBill, isTypeRequest, iouType, iouAmount, receiptPath, formattedAmount, isDistanceRequestWithoutRoute, translate]);

    const selectedParticipantsMemo = useMemo(() => selectedParticipants.filter((participant) => participant.selected), [selectedParticipants]);
    const payeePersonalDetailsMemo = useMemo(() => payeePersonalDetails ?? currentUserPersonalDetails, [payeePersonalDetails, currentUserPersonalDetails]);
    const canModifyParticipantsValue = !isReadOnly && canModifyParticipants && hasMultipleParticipants;

    const optionSelectorSections = useMemo(() => {
        const sections = [];
        const unselectedParticipants = selectedParticipants.filter((participant) => !participant.selected);
        if (hasMultipleParticipants) {
            const formattedSelectedParticipants = getParticipantsWithAmount(selectedParticipantsMemo);
            let formattedParticipantsList = [...new Set([...formattedSelectedParticipants, ...unselectedParticipants])];

            if (!canModifyParticipantsValue) {
                formattedParticipantsList = formattedParticipantsList.map((participant) => ({
                    ...participant,
                    isDisabled: ReportUtils.isOptimisticPersonalDetail(participant.accountID),
                }));
            }

            const myIOUAmount = IOUUtils.calculateAmount(selectedParticipantsMemo.length, iouAmount, iouCurrencyCode ?? '', true);
            const formattedPayeeOption = OptionsListUtils.getIOUConfirmationOptionsFromPayeePersonalDetail(
                payeePersonalDetailsMemo,
                iouAmount > 0 ? CurrencyUtils.convertToDisplayString(myIOUAmount, iouCurrencyCode) : '',
            );

            sections.push(
                {
                    title: translate('moneyRequestConfirmationList.paidBy'),
                    data: [formattedPayeeOption],
                    shouldShow: true,
                    indexOffset: 0,
                    isDisabled: canModifyParticipantsValue,
                },
                {
                    title: translate('moneyRequestConfirmationList.splitWith'),
                    data: formattedParticipantsList,
                    shouldShow: true,
                    indexOffset: 1,
                },
            );
        } else {
            const formattedSelectedParticipants = selectedParticipants.map((participant) => ({
                ...participant,
                isDisabled: ReportUtils.isOptimisticPersonalDetail(participant.accountID),
            }));
            sections.push({
                title: translate('common.to'),
                data: formattedSelectedParticipants,
                shouldShow: true,
                indexOffset: 0,
            });
        }
        return sections;
    }, [
        selectedParticipants,
        hasMultipleParticipants,
        iouAmount,
        iouCurrencyCode,
        getParticipantsWithAmount,
        payeePersonalDetailsMemo,
        translate,
        canModifyParticipantsValue,
        selectedParticipantsMemo,
    ]);

    const selectedOptions = useMemo(() => {
        if (!hasMultipleParticipants) {
            return [];
        }
        // TODO: check if this is needed
        const myIOUAmount = IOUUtils.calculateAmount(selectedParticipantsMemo.length, iouAmount, iouCurrencyCode ?? '', true);
        return [...selectedParticipantsMemo, OptionsListUtils.getIOUConfirmationOptionsFromPayeePersonalDetail(payeePersonalDetailsMemo, String(myIOUAmount))];
    }, [hasMultipleParticipants, selectedParticipantsMemo, iouAmount, iouCurrencyCode, payeePersonalDetailsMemo]);

    useEffect(() => {
        if (!isDistanceRequest) {
            return;
        }
        const distanceMerchant = DistanceRequestUtils.getDistanceMerchant(
            hasRoute,
            distance,
            mileageRate?.unit ?? CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES,
            mileageRate?.rate ?? 0,
            mileageRate?.currency ?? 'USD',
            translate,
            toLocaleDigit,
        );
        IOU.setMoneyRequestMerchant_temporaryForRefactor(transactionID, distanceMerchant);
    }, [hasRoute, distance, mileageRate?.unit, mileageRate?.rate, mileageRate?.currency, translate, toLocaleDigit, isDistanceRequest, transactionID]);

    /**
     * @param {Object} option
     */
    const selectParticipant = useCallback(
        (option: Participant) => {
            // Return early if selected option is currently logged in user.
            if (option.accountID === session?.accountID) {
                return;
            }
            onSelectParticipant(option);
        },
        [session?.accountID, onSelectParticipant],
    );

    /**
     * Navigate to report details or profile of selected user
     */
    const navigateToReportOrUserDetail = (option: Participant | OnyxTypes.Report) => {
        if ('accountID' in option) {
            const activeRoute = Navigation.getActiveRouteWithoutParams();

            Navigation.navigate(ROUTES.PROFILE.getRoute(option.accountID, activeRoute));
        } else if (option.reportID) {
            Navigation.navigate(ROUTES.REPORT_WITH_ID_DETAILS.getRoute(option.reportID));
        }
    };

    const confirm = useCallback(
        (paymentMethod: ValueOf<typeof CONST.IOU.PAYMENT_TYPE>) => {
            if (selectedParticipantsMemo.length === 0) {
                return;
            }
            if (iouCategory && iouCategory.length > CONST.API_TRANSACTION_CATEGORY_MAX_LENGTH) {
                setFormError('iou.error.invalidCategoryLength');
                return;
            }
            if (iouType === CONST.IOU.TYPE.SEND) {
                if (!paymentMethod) {
                    return;
                }

                setDidConfirm(true);

                Log.info(`[IOU] Sending money via: ${paymentMethod}`);
                onSendMoney(paymentMethod);
            } else {
                // validate the amount for distance requests
                const decimals = CurrencyUtils.getCurrencyDecimals(iouCurrencyCode);
                if (isDistanceRequest && !isDistanceRequestWithoutRoute && !MoneyRequestUtils.validateAmount(String(iouAmount), decimals)) {
                    setFormError('common.error.invalidAmount');
                    return;
                }

                if (isEditingSplitBill && TransactionUtils.areRequiredFieldsEmpty(transaction)) {
                    setDidConfirmSplit(true);
                    setFormError('iou.error.genericSmartscanFailureMessage');
                    return;
                }

                setDidConfirm(true);
                onConfirm(selectedParticipantsMemo);
            }
        },
        [
            selectedParticipantsMemo,
            iouCategory,
            iouType,
            onSendMoney,
            iouCurrencyCode,
            isDistanceRequest,
            isDistanceRequestWithoutRoute,
            iouAmount,
            isEditingSplitBill,
            transaction,
            onConfirm,
        ],
    );

    const footerContent = useMemo(() => {
        if (isReadOnly) {
            return;
        }

        const shouldShowSettlementButton = iouType === CONST.IOU.TYPE.SEND;
        const shouldDisableButton = selectedParticipantsMemo.length === 0 || shouldDisplayMerchantError;

        const button = shouldShowSettlementButton ? (
            <SettlementButton
                // @ts-expect-error TODO: Remove this once SettlementButton (https://github.com/Expensify/App/issues/25100) is migrated to TypeScript.
                pressOnEnter
                isDisabled={shouldDisableButton}
                onPress={confirm}
                enablePaymentsRoute={ROUTES.IOU_SEND_ENABLE_PAYMENTS}
                addBankAccountRoute={bankAccountRoute}
                addDebitCardRoute={ROUTES.IOU_SEND_ADD_DEBIT_CARD}
                currency={iouCurrencyCode}
                policyID={policyID}
                buttonSize={CONST.DROPDOWN_BUTTON_SIZE.LARGE}
                kycWallAnchorAlignment={{
                    horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.LEFT,
                    vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.BOTTOM,
                }}
                paymentMethodDropdownAnchorAlignment={{
                    horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.RIGHT,
                    vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.BOTTOM,
                }}
                shouldShowPersonalBankAccountOption
            />
        ) : (
            <ButtonWithDropdownMenu
                pressOnEnter
                isDisabled={shouldDisableButton}
                // eslint-disable-next-line @typescript-eslint/naming-convention
                onPress={(_event, value) => confirm(value)}
                options={splitOrRequestOptions}
                buttonSize={CONST.DROPDOWN_BUTTON_SIZE.LARGE}
            />
        );

        return (
            <>
                {formError && (
                    <FormHelpMessage
                        style={[styles.ph1, styles.mb2]}
                        isError
                        message={translate(formError)}
                    />
                )}
                {button}
            </>
        );
    }, [
        isReadOnly,
        iouType,
        selectedParticipantsMemo.length,
        shouldDisplayMerchantError,
        confirm,
        bankAccountRoute,
        iouCurrencyCode,
        policyID,
        splitOrRequestOptions,
        formError,
        styles.ph1,
        styles.mb2,
        translate,
    ]);

    const receiptData = ReceiptUtils.getThumbnailAndImageURIs(transaction, receiptPath, receiptFilename);
    return (
        // @ts-expect-error TODO: Remove this once OptionsSelector (https://github.com/Expensify/App/issues/25125) is migrated to TypeScript.
        <OptionsSelector
            sections={optionSelectorSections}
            onSelectRow={canModifyParticipantsValue ? selectParticipant : navigateToReportOrUserDetail}
            onAddToSelection={selectParticipant}
            onConfirmSelection={confirm}
            selectedOptions={selectedOptions}
            canSelectMultipleOptions={canModifyParticipantsValue}
            disableArrowKeysActions={!canModifyParticipantsValue}
            boldStyle
            showTitleTooltip
            shouldTextInputAppearBelowOptions
            shouldShowTextInput={false}
            shouldUseStyleForChildren={false}
            optionHoveredStyle={canModifyParticipantsValue ? styles.hoveredComponentBG : {}}
            footerContent={(!isEmpty(iou?.id) || isEditingSplitBill) && footerContent}
            listStyles={listStyles}
            shouldAllowScrollingChildren
        >
            {isDistanceRequest && (
                <View style={styles.confirmationListMapItem}>
                    <ConfirmedRoute transaction={transaction} />
                </View>
            )}
            {(receiptData.image || receiptData.thumbnail) && (
                <Image
                    style={styles.moneyRequestImage}
                    source={{uri: receiptData.thumbnail ?? receiptData.image}}
                    // AuthToken is required when retrieving the image from the server
                    // but we don't need it to load the blob:// or file:// image when starting a money request / split bill
                    // So if we have a thumbnail, it means we're retrieving the image from the server
                    isAuthTokenRequired={!!receiptData.thumbnail}
                />
            )}
            {shouldShowSmartScanFields && (
                <MenuItemWithTopDescription
                    shouldShowRightIcon={!isReadOnly && !isDistanceRequest}
                    title={formattedAmount}
                    description={translate('iou.amount')}
                    interactive={!isReadOnly}
                    onPress={() => {
                        if (isDistanceRequest) {
                            return;
                        }
                        if (isEditingSplitBill) {
                            Navigation.navigate(ROUTES.EDIT_SPLIT_BILL.getRoute(reportID, reportActionID ?? '', CONST.EDIT_REQUEST_FIELD.AMOUNT));
                            return;
                        }
                        Navigation.navigate(ROUTES.MONEY_REQUEST_AMOUNT.getRoute(iouType, reportID));
                    }}
                    style={{...styles.moneyRequestMenuItem, ...styles.mt2}}
                    titleStyle={styles.moneyRequestConfirmationAmount}
                    disabled={didConfirm}
                    brickRoadIndicator={shouldDisplayFieldError && TransactionUtils.isAmountMissing(transaction) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
                    error={shouldDisplayFieldError && TransactionUtils.isAmountMissing(transaction) ? translate('common.error.enterAmount') : ''}
                />
            )}
            <MenuItemWithTopDescription
                shouldShowRightIcon={!isReadOnly}
                shouldParseTitle
                title={iouComment}
                description={translate('common.description')}
                onPress={() => {
                    if (isEditingSplitBill) {
                        Navigation.navigate(ROUTES.EDIT_SPLIT_BILL.getRoute(reportID, reportActionID ?? '', CONST.EDIT_REQUEST_FIELD.DESCRIPTION));
                        return;
                    }
                    Navigation.navigate(ROUTES.MONEY_REQUEST_DESCRIPTION.getRoute(iouType, reportID));
                }}
                style={styles.moneyRequestMenuItem}
                titleStyle={styles.flex1}
                disabled={didConfirm}
                interactive={!isReadOnly}
                numberOfLinesTitle={2}
            />
            {!shouldShowAllFields && (
                <ShowMoreButton
                    containerStyle={styles.mt1}
                    onPress={toggleShouldExpandFields}
                />
            )}
            {shouldShowAllFields && (
                <>
                    {shouldShowDate && (
                        <MenuItemWithTopDescription
                            shouldShowRightIcon={!isReadOnly}
                            title={iouCreated ?? format(new Date(), CONST.DATE.FNS_FORMAT_STRING)}
                            description={translate('common.date')}
                            style={styles.moneyRequestMenuItem}
                            titleStyle={styles.flex1}
                            onPress={() => {
                                if (isEditingSplitBill) {
                                    Navigation.navigate(ROUTES.EDIT_SPLIT_BILL.getRoute(reportID, reportActionID ?? '', CONST.EDIT_REQUEST_FIELD.DATE));
                                    return;
                                }
                                Navigation.navigate(ROUTES.MONEY_REQUEST_DATE.getRoute(iouType, reportID));
                            }}
                            disabled={didConfirm}
                            interactive={!isReadOnly}
                            brickRoadIndicator={shouldDisplayFieldError && TransactionUtils.isCreatedMissing(transaction) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
                            error={shouldDisplayFieldError && TransactionUtils.isCreatedMissing(transaction) ? translate('common.error.enterDate') : ''}
                        />
                    )}
                    {isDistanceRequest && (
                        <MenuItemWithTopDescription
                            shouldShowRightIcon={!isReadOnly && isTypeRequest}
                            title={iouMerchant}
                            description={translate('common.distance')}
                            style={styles.moneyRequestMenuItem}
                            titleStyle={styles.flex1}
                            onPress={() => Navigation.navigate(ROUTES.MONEY_REQUEST_DISTANCE.getRoute(iouType, reportID))}
                            disabled={didConfirm || !isTypeRequest}
                            interactive={!isReadOnly}
                        />
                    )}
                    {shouldShowMerchant && (
                        <MenuItemWithTopDescription
                            shouldShowRightIcon={!isReadOnly}
                            title={isMerchantEmpty ? '' : iouMerchant}
                            description={translate('common.merchant')}
                            style={styles.moneyRequestMenuItem}
                            titleStyle={styles.flex1}
                            onPress={() => {
                                if (isEditingSplitBill) {
                                    Navigation.navigate(ROUTES.EDIT_SPLIT_BILL.getRoute(reportID, reportActionID ?? '', CONST.EDIT_REQUEST_FIELD.MERCHANT));
                                    return;
                                }
                                Navigation.navigate(ROUTES.MONEY_REQUEST_MERCHANT.getRoute(iouType, reportID));
                            }}
                            disabled={didConfirm}
                            interactive={!isReadOnly}
                            brickRoadIndicator={shouldDisplayFieldError && TransactionUtils.isMerchantMissing(transaction) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
                            error={shouldDisplayMerchantError || (shouldDisplayFieldError && TransactionUtils.isMerchantMissing(transaction)) ? translate('common.error.enterMerchant') : ''}
                        />
                    )}
                    {shouldShowCategories && (
                        <MenuItemWithTopDescription
                            shouldShowRightIcon={!isReadOnly}
                            title={iouCategory}
                            description={translate('common.category')}
                            numberOfLinesTitle={2}
                            onPress={() => {
                                if (isEditingSplitBill) {
                                    Navigation.navigate(ROUTES.EDIT_SPLIT_BILL.getRoute(reportID, reportActionID ?? '', CONST.EDIT_REQUEST_FIELD.CATEGORY));
                                    return;
                                }
                                Navigation.navigate(ROUTES.MONEY_REQUEST_CATEGORY.getRoute(iouType, reportID));
                            }}
                            style={styles.moneyRequestMenuItem}
                            titleStyle={styles.flex1}
                            disabled={didConfirm}
                            interactive={!isReadOnly}
                            rightLabel={canUseViolations && Boolean(policy?.requiresCategory) ? translate('common.required') : ''}
                        />
                    )}
                    {shouldShowTags && (
                        <MenuItemWithTopDescription
                            shouldShowRightIcon={!isReadOnly}
                            title={iouTag}
                            description={policyTagListName}
                            numberOfLinesTitle={2}
                            onPress={() => {
                                if (isEditingSplitBill) {
                                    Navigation.navigate(ROUTES.EDIT_SPLIT_BILL.getRoute(reportID, reportActionID ?? '', CONST.EDIT_REQUEST_FIELD.TAG));
                                    return;
                                }
                                Navigation.navigate(ROUTES.MONEY_REQUEST_TAG.getRoute(iouType, reportID));
                            }}
                            style={styles.moneyRequestMenuItem}
                            disabled={didConfirm}
                            interactive={!isReadOnly}
                            rightLabel={canUseViolations && Boolean(policy?.requiresTag) ? translate('common.required') : ''}
                        />
                    )}

                    {shouldShowTax && (
                        <MenuItemWithTopDescription
                            shouldShowRightIcon={!isReadOnly}
                            title={taxRateTitle}
                            description={policyTaxRates?.name}
                            style={styles.moneyRequestMenuItem}
                            titleStyle={styles.flex1}
                            onPress={() =>
                                Navigation.navigate(
                                    ROUTES.MONEY_REQUEST_STEP_TAX_RATE.getRoute(iouType, transaction?.transactionID ?? '', reportID, Navigation.getActiveRouteWithoutParams()),
                                )
                            }
                            disabled={didConfirm}
                            interactive={!isReadOnly}
                        />
                    )}

                    {shouldShowTax && (
                        <MenuItemWithTopDescription
                            shouldShowRightIcon={!isReadOnly}
                            title={formattedTaxAmount}
                            description={policyTaxRates?.name}
                            style={styles.moneyRequestMenuItem}
                            titleStyle={styles.flex1}
                            onPress={() =>
                                Navigation.navigate(
                                    ROUTES.MONEY_REQUEST_STEP_TAX_AMOUNT.getRoute(iouType, transaction?.transactionID ?? '', reportID, Navigation.getActiveRouteWithoutParams()),
                                )
                            }
                            disabled={didConfirm}
                            interactive={!isReadOnly}
                        />
                    )}

                    {shouldShowBillable && (
                        <View style={[styles.flexRow, styles.justifyContentBetween, styles.alignItemsCenter, styles.ml5, styles.mr8, styles.optionRow]}>
                            <Text color={!iouIsBillable ? theme.textSupporting : undefined}>{translate('common.billable')}</Text>
                            <Switch
                                accessibilityLabel={translate('common.billable')}
                                isOn={iouIsBillable}
                                onToggle={onToggleBillable}
                            />
                        </View>
                    )}
                </>
            )}
        </OptionsSelector>
    );
}

MoneyRequestConfirmationList.displayName = 'MoneyRequestConfirmationList';

export default withCurrentUserPersonalDetails(
    withOnyx<MoneyRequestConfirmationListProps, MoneyRequestConfirmationListOnyxProps>({
        policyCategories: {
            key: ({policyID}) => `${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${policyID}`,
        },
        policyTags: {
            key: ({policyID}) => `${ONYXKEYS.COLLECTION.POLICY_TAGS}${policyID}`,
        },
        mileageRate: {
            key: ({policyID}) => `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            selector: DistanceRequestUtils.getDefaultMileageRate,
        },
        policy: {
            key: ({policyID}) => `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
        },
        policyTaxRates: {
            key: ({policyID}) => `${ONYXKEYS.COLLECTION.POLICY_TAX_RATE}${policyID}`,
        },
        iou: {
            key: ONYXKEYS.IOU,
        },
    })(MoneyRequestConfirmationList),
);
