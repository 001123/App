import _ from 'lodash';
import type {ForwardedRef, RefObject} from 'react';
import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {GestureResponderEvent} from 'react-native';
import {ActivityIndicator, Dimensions, ScrollView, View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import AddPaymentMethodMenu from '@components/AddPaymentMethodMenu';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import CurrentWalletBalance from '@components/CurrentWalletBalance';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import * as Illustrations from '@components/Icon/Illustrations';
import KYCWall from '@components/KYCWall';
import type {Source, TransferMethod} from '@components/KYCWall/types';
import MenuItem from '@components/MenuItem';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import Popover from '@components/Popover';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import WalletSection from '@components/WalletSection';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import getClickedTargetLocation from '@libs/getClickedTargetLocation';
import Navigation from '@libs/Navigation/Navigation';
import * as PaymentUtils from '@libs/PaymentUtils';
import PaymentMethodList from '@pages/settings/Wallet/PaymentMethodList';
import WalletEmptyState from '@pages/settings/Wallet/WalletEmptyState';
import variables from '@styles/variables';
import * as BankAccounts from '@userActions/BankAccounts';
import * as PaymentMethods from '@userActions/PaymentMethods';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {AccountData} from '@src/types/onyx';
import type IconAsset from '@src/types/utils/IconAsset';
import type {WalletPageOnyxProps, WalletPageProps} from './types';

type FormattedSelectedPaymentMethod = {
    title: string;
    icon?: IconAsset;
    description?: string;
    type?: string;
};

type PaymentMethodState = {
    isSelectedPaymentMethodDefault: boolean;
    selectedPaymentMethod: AccountData;
    formattedSelectedPaymentMethod: FormattedSelectedPaymentMethod;
    methodID: string | number;
    selectedPaymentMethodType: string;
};

function WalletPage({bankAccountList = {}, cardList = {}, fundList = {}, isLoadingPaymentMethods = true, shouldListenForResize = false, userWallet, walletTerms = {}}: WalletPageProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const network = useNetwork();
    const {isSmallScreenWidth, windowWidth} = useWindowDimensions();
    const [shouldShowAddPaymentMenu, setShouldShowAddPaymentMenu] = useState(false);
    const [shouldShowDefaultDeleteMenu, setShouldShowDefaultDeleteMenu] = useState(false);
    const [shouldShowLoadingSpinner, setShouldShowLoadingSpinner] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodState>({
        isSelectedPaymentMethodDefault: false,
        selectedPaymentMethod: {},
        formattedSelectedPaymentMethod: {
            title: '',
        },
        methodID: '',
        selectedPaymentMethodType: '',
    });
    const addPaymentMethodAnchorRef = useRef(null);
    const paymentMethodButtonRef = useRef<HTMLElement | null>(null);
    const [anchorPosition, setAnchorPosition] = useState({
        anchorPositionHorizontal: 0,
        anchorPositionVertical: 0,
        anchorPositionTop: 0,
        anchorPositionRight: 0,
    });
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const hasBankAccount = !_.isEmpty(bankAccountList) || !_.isEmpty(fundList);
    const hasWallet = !_.isEmpty(userWallet);
    const hasActivatedWallet = ([CONST.WALLET.TIER_NAME.GOLD, CONST.WALLET.TIER_NAME.PLATINUM] as string[]).includes(userWallet?.tierName ?? '');
    const hasAssignedCard = !_.isEmpty(cardList);
    const shouldShowEmptyState = !hasBankAccount && !hasWallet && !hasAssignedCard;

    const isPendingOnfidoResult = userWallet?.isPendingOnfidoResult ?? false;
    const hasFailedOnfido = userWallet?.hasFailedOnfido ?? false;

    const updateShouldShowLoadingSpinner = useCallback(() => {
        // In order to prevent a loop, only update state of the spinner if there is a change
        const showLoadingSpinner = isLoadingPaymentMethods ?? false;
        if (showLoadingSpinner !== shouldShowLoadingSpinner) {
            setShouldShowLoadingSpinner(showLoadingSpinner && !network.isOffline);
        }
    }, [isLoadingPaymentMethods, network.isOffline, shouldShowLoadingSpinner]);

    const debounceSetShouldShowLoadingSpinner = _.debounce(updateShouldShowLoadingSpinner, CONST.TIMING.SHOW_LOADING_SPINNER_DEBOUNCE_TIME);

    /**
     * Set position of the payment menu
     */
    const setMenuPosition = useCallback(() => {
        if (!paymentMethodButtonRef.current) {
            return;
        }

        const position = getClickedTargetLocation(paymentMethodButtonRef.current);

        setAnchorPosition({
            anchorPositionTop: position.top + position.height + variables.addPaymentPopoverTopSpacing,
            // We want the position to be 23px to the right of the left border
            anchorPositionRight: windowWidth - position.right - variables.addBankAccountLeftSpacing,
            anchorPositionHorizontal: position.x + (shouldShowEmptyState ? -variables.addPaymentMethodLeftSpacing : variables.addBankAccountLeftSpacing),
            anchorPositionVertical: position.y,
        });
    }, [shouldShowEmptyState, windowWidth]);

    const getSelectedPaymentMethodID = useCallback(() => {
        if (paymentMethod.selectedPaymentMethodType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT) {
            return paymentMethod.selectedPaymentMethod.bankAccountID;
        }
        if (paymentMethod.selectedPaymentMethodType === CONST.PAYMENT_METHODS.DEBIT_CARD) {
            return paymentMethod.selectedPaymentMethod.fundID;
        }
    }, [paymentMethod.selectedPaymentMethod.bankAccountID, paymentMethod.selectedPaymentMethod.fundID, paymentMethod.selectedPaymentMethodType]);

    const resetSelectedPaymentMethodData = useCallback(() => {
        // Reset to same values as in the constructor
        setPaymentMethod({
            isSelectedPaymentMethodDefault: false,
            selectedPaymentMethod: {},
            formattedSelectedPaymentMethod: {
                title: '',
            },
            methodID: '',
            selectedPaymentMethodType: '',
        });
    }, [setPaymentMethod]);

    /**
     * Display the delete/default menu, or the add payment method menu
     */
    const paymentMethodPressed = (
        nativeEvent?: GestureResponderEvent | KeyboardEvent,
        accountType?: string,
        account?: AccountData,
        icon?: IconAsset,
        isDefault?: boolean,
        methodID?: string | number,
    ) => {
        if (shouldShowAddPaymentMenu) {
            setShouldShowAddPaymentMenu(false);
            return;
        }

        if (shouldShowDefaultDeleteMenu) {
            setShouldShowDefaultDeleteMenu(false);
            return;
        }
        paymentMethodButtonRef.current = nativeEvent?.currentTarget as HTMLElement;

        // The delete/default menu
        if (accountType) {
            let formattedSelectedPaymentMethod: FormattedSelectedPaymentMethod = {
                title: '',
            };
            if (accountType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT) {
                formattedSelectedPaymentMethod = {
                    title: account?.addressName ?? '',
                    icon,
                    description: PaymentUtils.getPaymentMethodDescription(accountType, account),
                    type: CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT,
                };
            } else if (accountType === CONST.PAYMENT_METHODS.DEBIT_CARD) {
                formattedSelectedPaymentMethod = {
                    title: account?.addressName ?? '',
                    icon,
                    description: PaymentUtils.getPaymentMethodDescription(accountType, account),
                    type: CONST.PAYMENT_METHODS.DEBIT_CARD,
                };
            }
            setPaymentMethod({
                isSelectedPaymentMethodDefault: !!isDefault,
                selectedPaymentMethod: account ?? {},
                selectedPaymentMethodType: accountType,
                formattedSelectedPaymentMethod,
                methodID: methodID ?? '',
            });
            setShouldShowDefaultDeleteMenu(true);
            setMenuPosition();
            return;
        }
        setShouldShowAddPaymentMenu(true);
        setMenuPosition();
    };

    /**
     * Hide the add payment modal
     */
    const hideAddPaymentMenu = () => {
        setShouldShowAddPaymentMenu(false);
    };

    /**
     * Navigate to the appropriate payment type addition screen
     */
    const addPaymentMethodTypePressed = (paymentType: string) => {
        hideAddPaymentMenu();

        if (paymentType === CONST.PAYMENT_METHODS.DEBIT_CARD) {
            Navigation.navigate(ROUTES.SETTINGS_ADD_DEBIT_CARD);
            return;
        }
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (paymentType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT || paymentType === CONST.PAYMENT_METHODS.BUSINESS_BANK_ACCOUNT) {
            BankAccounts.openPersonalBankAccountSetupView();
            return;
        }

        throw new Error('Invalid payment method type selected');
    };

    /**
     * Hide the default / delete modal
     */
    const hideDefaultDeleteMenu = useCallback(() => {
        setShouldShowDefaultDeleteMenu(false);
        setShowConfirmDeleteModal(false);
    }, [setShouldShowDefaultDeleteMenu, setShowConfirmDeleteModal]);

    const makeDefaultPaymentMethod = useCallback(() => {
        const paymentCardList = fundList ?? {};
        // Find the previous default payment method so we can revert if the MakeDefaultPaymentMethod command errors
        const paymentMethods = PaymentUtils.formatPaymentMethods(bankAccountList ?? {}, paymentCardList, styles);

        const previousPaymentMethod = paymentMethods.find((method) => !!method.isDefault);
        const currentPaymentMethod = paymentMethods.find((method) => method.methodID === paymentMethod.methodID);
        if (paymentMethod.selectedPaymentMethodType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT) {
            PaymentMethods.makeDefaultPaymentMethod(paymentMethod.selectedPaymentMethod.bankAccountID ?? null, null, previousPaymentMethod, currentPaymentMethod);
        } else if (paymentMethod.selectedPaymentMethodType === CONST.PAYMENT_METHODS.DEBIT_CARD) {
            PaymentMethods.makeDefaultPaymentMethod(null, paymentMethod.selectedPaymentMethod.fundID ?? null, previousPaymentMethod, currentPaymentMethod);
        }
    }, [
        paymentMethod.methodID,
        paymentMethod.selectedPaymentMethod.bankAccountID,
        paymentMethod.selectedPaymentMethod.fundID,
        paymentMethod.selectedPaymentMethodType,
        bankAccountList,
        fundList,
        styles,
    ]);

    const deletePaymentMethod = useCallback(() => {
        const bankAccountID = paymentMethod.selectedPaymentMethod.bankAccountID;
        const fundID = paymentMethod.selectedPaymentMethod.fundID;
        if (paymentMethod.selectedPaymentMethodType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT && bankAccountID) {
            BankAccounts.deletePaymentBankAccount(bankAccountID);
        } else if (paymentMethod.selectedPaymentMethodType === CONST.PAYMENT_METHODS.DEBIT_CARD && fundID) {
            PaymentMethods.deletePaymentCard(fundID);
        }
    }, [paymentMethod.selectedPaymentMethod.bankAccountID, paymentMethod.selectedPaymentMethod.fundID, paymentMethod.selectedPaymentMethodType]);

    /**
     * Navigate to the appropriate page after completing the KYC flow, depending on what initiated it
     */
    const navigateToWalletOrTransferBalancePage = (source?: Source) => {
        Navigation.navigate(source === CONST.KYC_WALL_SOURCE.ENABLE_WALLET ? ROUTES.SETTINGS_WALLET : ROUTES.SETTINGS_WALLET_TRANSFER_BALANCE);
    };

    useEffect(() => {
        PaymentMethods.openWalletPage();
    }, []);

    useEffect(() => {
        // If the user was previously offline, skip debouncing showing the loader
        if (!network.isOffline) {
            updateShouldShowLoadingSpinner();
        } else {
            debounceSetShouldShowLoadingSpinner();
        }
    }, [network.isOffline, debounceSetShouldShowLoadingSpinner, updateShouldShowLoadingSpinner]);

    useEffect(() => {
        if (network.isOffline) {
            return;
        }
        PaymentMethods.openWalletPage();
    }, [network.isOffline]);

    useLayoutEffect(() => {
        if (!shouldListenForResize) {
            return;
        }
        const popoverPositionListener = Dimensions.addEventListener('change', () => {
            if (!shouldShowAddPaymentMenu && !shouldShowDefaultDeleteMenu) {
                return;
            }
            if (shouldShowAddPaymentMenu) {
                _.debounce(setMenuPosition, CONST.TIMING.RESIZE_DEBOUNCE_TIME)();
                return;
            }
            setMenuPosition();
        });
        return () => {
            if (!popoverPositionListener) {
                return;
            }
            popoverPositionListener.remove();
        };
    }, [shouldShowAddPaymentMenu, shouldShowDefaultDeleteMenu, setMenuPosition, shouldListenForResize]);

    useEffect(() => {
        if (!shouldShowDefaultDeleteMenu) {
            return;
        }

        // We should reset selected payment method state values and close corresponding modals if the selected payment method is deleted
        let shouldResetPaymentMethodData = false;

        if (paymentMethod.selectedPaymentMethodType === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT && _.isEmpty(bankAccountList?.[paymentMethod.methodID])) {
            shouldResetPaymentMethodData = true;
        } else if (paymentMethod.selectedPaymentMethodType === CONST.PAYMENT_METHODS.DEBIT_CARD && _.isEmpty(fundList?.[paymentMethod.methodID])) {
            shouldResetPaymentMethodData = true;
        }
        if (shouldResetPaymentMethodData) {
            // Close corresponding selected payment method modals which are open
            if (shouldShowDefaultDeleteMenu) {
                hideDefaultDeleteMenu();
            }
        }
    }, [hideDefaultDeleteMenu, paymentMethod.methodID, paymentMethod.selectedPaymentMethodType, bankAccountList, fundList, shouldShowDefaultDeleteMenu]);

    const shouldShowMakeDefaultButton =
        !paymentMethod.isSelectedPaymentMethodDefault &&
        !(paymentMethod.formattedSelectedPaymentMethod.type === CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT && paymentMethod.selectedPaymentMethod.type === CONST.BANK_ACCOUNT.TYPE.BUSINESS);

    // Determines whether or not the modal popup is mounted from the bottom of the screen instead of the side mount on Web or Desktop screens
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const isPopoverBottomMount = anchorPosition.anchorPositionTop === 0 || isSmallScreenWidth;
    const alertTextStyle = [styles.inlineSystemMessage, styles.flexShrink1];
    const alertViewStyle = [styles.flexRow, styles.alignItemsCenter, styles.w100, styles.ph5];

    return (
        <>
            {shouldShowEmptyState ? (
                <WalletEmptyState onAddPaymentMethod={paymentMethodPressed} />
            ) : (
                <ScreenWrapper testID={WalletPage.displayName}>
                    <HeaderWithBackButton
                        title={translate('common.wallet')}
                        onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS)}
                    />
                    <View style={[styles.flex1, styles.mb4]}>
                        <ScrollView>
                            <OfflineWithFeedback
                                style={styles.flex1}
                                contentContainerStyle={styles.flex1}
                                onClose={PaymentMethods.clearWalletError}
                                errors={userWallet?.errors}
                                errorRowStyles={[styles.ph6]}
                            >
                                {hasWallet && (
                                    <WalletSection
                                        icon={Illustrations.MoneyIntoWallet}
                                        subtitle={translate(`walletPage.${hasActivatedWallet ? 'sendAndReceiveMoney' : 'enableWalletToSendAndReceiveMoney'}`)}
                                        title={translate('walletPage.expensifyWallet')}
                                    >
                                        <>
                                            {shouldShowLoadingSpinner ? (
                                                <ActivityIndicator
                                                    color={theme.spinner}
                                                    size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
                                                    style={[styles.mt7, styles.mb5]}
                                                />
                                            ) : (
                                                <OfflineWithFeedback
                                                    pendingAction={CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD}
                                                    errors={walletTerms?.errors}
                                                    onClose={PaymentMethods.clearWalletTermsError}
                                                    errorRowStyles={[styles.ml10, styles.mr2]}
                                                    style={[styles.mt7, styles.mb5]}
                                                >
                                                    <CurrentWalletBalance balanceStyles={[styles.walletBalance]} />
                                                </OfflineWithFeedback>
                                            )}

                                            <KYCWall
                                                // eslint-disable-next-line @typescript-eslint/naming-convention
                                                onSuccessfulKYC={(source?: Source) => navigateToWalletOrTransferBalancePage(source)}
                                                onSelectPaymentMethod={(selectedPaymentMethod: string) => {
                                                    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                                                    if (hasActivatedWallet || selectedPaymentMethod !== CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT) {
                                                        return;
                                                    }
                                                    // To allow upgrading to a gold wallet, continue with the KYC flow after adding a bank account
                                                    BankAccounts.setPersonalBankAccountContinueKYCOnSuccess(ROUTES.SETTINGS_WALLET);
                                                }}
                                                enablePaymentsRoute={ROUTES.SETTINGS_ENABLE_PAYMENTS}
                                                addBankAccountRoute={ROUTES.SETTINGS_ADD_BANK_ACCOUNT}
                                                addDebitCardRoute={ROUTES.SETTINGS_ADD_DEBIT_CARD}
                                                source={hasActivatedWallet ? CONST.KYC_WALL_SOURCE.TRANSFER_BALANCE : CONST.KYC_WALL_SOURCE.ENABLE_WALLET}
                                                shouldIncludeDebitCard={hasActivatedWallet}
                                            >
                                                {(
                                                    triggerKYCFlow: (event?: GestureResponderEvent | KeyboardEvent, iouPaymentType?: TransferMethod) => void,
                                                    buttonRef: ForwardedRef<HTMLElement>,
                                                ) => {
                                                    if (shouldShowLoadingSpinner) {
                                                        return null;
                                                    }

                                                    if (hasActivatedWallet) {
                                                        return (
                                                            <MenuItem
                                                                ref={buttonRef as ForwardedRef<View>}
                                                                title={translate('common.transferBalance')}
                                                                icon={Expensicons.Transfer}
                                                                onPress={triggerKYCFlow}
                                                                shouldShowRightIcon
                                                                disabled={network.isOffline}
                                                                wrapperStyle={styles.transferBalance}
                                                            />
                                                        );
                                                    }

                                                    if (isPendingOnfidoResult) {
                                                        return (
                                                            <View style={alertViewStyle}>
                                                                <Icon
                                                                    src={Expensicons.Hourglass}
                                                                    fill={theme.icon}
                                                                />

                                                                <Text style={alertTextStyle}>{translate('walletPage.walletActivationPending')}</Text>
                                                            </View>
                                                        );
                                                    }

                                                    if (hasFailedOnfido) {
                                                        return (
                                                            <View style={alertViewStyle}>
                                                                <Icon
                                                                    src={Expensicons.Exclamation}
                                                                    fill={theme.icon}
                                                                />

                                                                <Text style={alertTextStyle}>{translate('walletPage.walletActivationFailed')}</Text>
                                                            </View>
                                                        );
                                                    }

                                                    return (
                                                        <Button
                                                            ref={buttonRef as ForwardedRef<View>}
                                                            text={translate('walletPage.enableWallet')}
                                                            onPress={triggerKYCFlow}
                                                            style={styles.mh5}
                                                            isDisabled={network.isOffline}
                                                            success
                                                            large
                                                        />
                                                    );
                                                }}
                                            </KYCWall>
                                        </>
                                    </WalletSection>
                                )}
                                {hasAssignedCard ? (
                                    <WalletSection
                                        icon={Illustrations.CreditCardsNew}
                                        subtitle={translate('walletPage.assignedCardsDescription')}
                                        title={translate('walletPage.assignedCards')}
                                    >
                                        <PaymentMethodList
                                            shouldShowAddBankAccount={false}
                                            shouldShowAddPaymentMethodButton={false}
                                            shouldShowAssignedCards
                                            shouldShowEmptyListMessage={false}
                                            shouldEnableScroll={false}
                                            onPress={paymentMethodPressed}
                                            style={styles.mt5}
                                            actionPaymentMethodType={shouldShowDefaultDeleteMenu ? paymentMethod.selectedPaymentMethodType : ''}
                                            activePaymentMethodID={shouldShowDefaultDeleteMenu ? getSelectedPaymentMethodID() : ''}
                                            buttonRef={addPaymentMethodAnchorRef}
                                            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                                            onListContentSizeChange={shouldShowAddPaymentMenu || shouldShowDefaultDeleteMenu ? setMenuPosition : () => {}}
                                        />
                                    </WalletSection>
                                ) : null}
                                <WalletSection
                                    icon={Illustrations.BankArrow}
                                    subtitle={translate('walletPage.addBankAccountToSendAndReceive')}
                                    title={translate('walletPage.bankAccounts')}
                                >
                                    <PaymentMethodList
                                        shouldShowAddPaymentMethodButton={false}
                                        shouldShowEmptyListMessage={false}
                                        onPress={paymentMethodPressed}
                                        actionPaymentMethodType={shouldShowDefaultDeleteMenu ? paymentMethod.selectedPaymentMethodType : ''}
                                        activePaymentMethodID={shouldShowDefaultDeleteMenu ? getSelectedPaymentMethodID() : ''}
                                        buttonRef={addPaymentMethodAnchorRef}
                                        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                                        onListContentSizeChange={shouldShowAddPaymentMenu || shouldShowDefaultDeleteMenu ? setMenuPosition : () => {}}
                                        shouldEnableScroll={false}
                                        style={styles.mt5}
                                    />
                                </WalletSection>
                            </OfflineWithFeedback>
                        </ScrollView>
                    </View>
                    <Popover
                        isVisible={shouldShowDefaultDeleteMenu}
                        onClose={hideDefaultDeleteMenu}
                        anchorPosition={{
                            top: anchorPosition.anchorPositionTop,
                            right: anchorPosition.anchorPositionRight,
                        }}
                        anchorRef={paymentMethodButtonRef as RefObject<View>}
                    >
                        {!showConfirmDeleteModal && (
                            <View style={[styles.m5, !isSmallScreenWidth ? styles.sidebarPopover : {}]}>
                                {isPopoverBottomMount && (
                                    <MenuItem
                                        title={paymentMethod.formattedSelectedPaymentMethod.title}
                                        icon={paymentMethod.formattedSelectedPaymentMethod.icon}
                                        description={paymentMethod.formattedSelectedPaymentMethod.description}
                                        wrapperStyle={[styles.pv0, styles.ph0, styles.mb4]}
                                        interactive={false}
                                    />
                                )}
                                {shouldShowMakeDefaultButton && (
                                    <Button
                                        onPress={() => {
                                            makeDefaultPaymentMethod();
                                            setShouldShowDefaultDeleteMenu(false);
                                        }}
                                        text={translate('walletPage.setDefaultConfirmation')}
                                    />
                                )}
                                <Button
                                    onPress={() => setShowConfirmDeleteModal(true)}
                                    style={[shouldShowMakeDefaultButton ? styles.mt4 : {}]}
                                    text={translate('common.delete')}
                                    danger
                                />
                            </View>
                        )}
                        <ConfirmModal
                            isVisible={showConfirmDeleteModal}
                            onConfirm={() => {
                                deletePaymentMethod();
                                hideDefaultDeleteMenu();
                            }}
                            onCancel={hideDefaultDeleteMenu}
                            title={translate('walletPage.deleteAccount')}
                            prompt={translate('walletPage.deleteConfirmation')}
                            confirmText={translate('common.delete')}
                            cancelText={translate('common.cancel')}
                            shouldShowCancelButton
                            danger
                            onModalHide={resetSelectedPaymentMethodData}
                        />
                    </Popover>
                </ScreenWrapper>
            )}
            <AddPaymentMethodMenu
                isVisible={shouldShowAddPaymentMenu}
                onClose={hideAddPaymentMenu}
                anchorPosition={{
                    horizontal: anchorPosition.anchorPositionHorizontal,
                    vertical: anchorPosition.anchorPositionVertical - CONST.MODAL.POPOVER_MENU_PADDING,
                }}
                onItemSelected={(method: string) => addPaymentMethodTypePressed(method)}
                anchorRef={addPaymentMethodAnchorRef}
                shouldShowPersonalBankAccountOption
            />
        </>
    );
}

WalletPage.displayName = 'WalletPage';

export default withOnyx<WalletPageProps, WalletPageOnyxProps>({
    cardList: {
        key: ONYXKEYS.CARD_LIST,
    },
    walletTransfer: {
        key: ONYXKEYS.WALLET_TRANSFER,
    },
    userWallet: {
        key: ONYXKEYS.USER_WALLET,
    },
    bankAccountList: {
        key: ONYXKEYS.BANK_ACCOUNT_LIST,
    },
    fundList: {
        key: ONYXKEYS.FUND_LIST,
    },
    walletTerms: {
        key: ONYXKEYS.WALLET_TERMS,
    },
    isLoadingPaymentMethods: {
        key: ONYXKEYS.IS_LOADING_PAYMENT_METHODS,
    },
})(WalletPage);
