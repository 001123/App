import React, {useEffect, useRef} from 'react';
import type {TextInput as RNTextInput} from 'react-native';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import {withOnyx} from 'react-native-onyx';
import AddressSearch from '@components/AddressSearch';
import CheckboxWithLabel from '@components/CheckboxWithLabel';
import FormProvider from '@components/Form/FormProvider';
import InputWrapper from '@components/Form/InputWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import StatePicker from '@components/StatePicker';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import TextLink from '@components/TextLink';
import useLocalize from '@hooks/useLocalize';
import usePrevious from '@hooks/usePrevious';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as ValidationUtils from '@libs/ValidationUtils';
import * as PaymentMethods from '@userActions/PaymentMethods';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {AddDebitCardForm} from '@src/types/onyx';
import {Errors} from '@src/types/onyx/OnyxCommon';

type DebitCardPageOnyxProps = {
    /** Form data propTypes */
    formData: OnyxEntry<AddDebitCardForm>;
};

type DebitCardPageProps = DebitCardPageOnyxProps;

function DebitCardPage({formData}: DebitCardPageProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const setupComplete = formData?.setupComplete ?? false;
    const prevFormDataSetupComplete = usePrevious(setupComplete);
    const nameOnCardRef = useRef<RNTextInput>(null);

    /**
     * Reset the form values on the mount and unmount so that old errors don't show when this form is displayed again.
     */
    useEffect(() => {
        PaymentMethods.clearDebitCardFormErrorAndSubmit();

        return () => {
            PaymentMethods.clearDebitCardFormErrorAndSubmit();
        };
    }, []);

    useEffect(() => {
        if (prevFormDataSetupComplete || !setupComplete) {
            return;
        }

        PaymentMethods.continueSetup();
    }, [prevFormDataSetupComplete, setupComplete]);

    const validate = (values: Errors) => {
        const requiredFields = ['nameOnCard', 'cardNumber', 'expirationDate', 'securityCode', 'addressStreet', 'addressZipCode', 'addressState'];
        const errors = ValidationUtils.getFieldRequiredErrors(values, requiredFields);

        if (values.nameOnCard && !ValidationUtils.isValidLegalName(values.nameOnCard)) {
            errors.nameOnCard = 'addDebitCardPage.error.invalidName';
        }

        if (values.cardNumber && !ValidationUtils.isValidDebitCard(values.cardNumber.replace(/ /g, ''))) {
            errors.cardNumber = 'addDebitCardPage.error.debitCardNumber';
        }

        if (values.expirationDate && !ValidationUtils.isValidExpirationDate(values.expirationDate)) {
            errors.expirationDate = 'addDebitCardPage.error.expirationDate';
        }

        if (values.securityCode && !ValidationUtils.isValidSecurityCode(values.securityCode)) {
            errors.securityCode = 'addDebitCardPage.error.securityCode';
        }

        if (values.addressStreet && !ValidationUtils.isValidAddress(values.addressStreet)) {
            errors.addressStreet = 'addDebitCardPage.error.addressStreet';
        }

        if (values.addressZipCode && !ValidationUtils.isValidZipCode(values.addressZipCode)) {
            errors.addressZipCode = 'addDebitCardPage.error.addressZipCode';
        }

        if (!values.acceptTerms) {
            errors.acceptTerms = 'common.error.acceptTerms';
        }

        return errors;
    };

    return (
        <ScreenWrapper
            onEntryTransitionEnd={() => nameOnCardRef.current?.focus()}
            includeSafeAreaPaddingBottom={false}
            testID={DebitCardPage.displayName}
        >
            <HeaderWithBackButton
                title={translate('addDebitCardPage.addADebitCard')}
                onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS_WALLET)}
            />
            {/** @ts-expect-error TODO: Remove this once FormProvider (https://github.com/Expensify/App/issues/31972) is migrated to TypeScript. */}
            <FormProvider
                formID={ONYXKEYS.FORMS.ADD_DEBIT_CARD_FORM}
                validate={validate}
                onSubmit={PaymentMethods.addPaymentCard}
                submitButtonText={translate('common.save')}
                scrollContextEnabled
                style={[styles.mh5, styles.flexGrow1]}
            >
                <InputWrapper
                    // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/31972) is migrated to TypeScript.
                    InputComponent={TextInput}
                    inputID="nameOnCard"
                    label={translate('addDebitCardPage.nameOnCard')}
                    aria-label={translate('addDebitCardPage.nameOnCard')}
                    role={CONST.ROLE.PRESENTATION}
                    ref={nameOnCardRef}
                    spellCheck={false}
                />
                <InputWrapper
                    // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/31972) is migrated to TypeScript.
                    InputComponent={TextInput}
                    inputID="cardNumber"
                    label={translate('addDebitCardPage.debitCardNumber')}
                    aria-label={translate('addDebitCardPage.debitCardNumber')}
                    role={CONST.ROLE.PRESENTATION}
                    containerStyles={[styles.mt4]}
                    inputMode={CONST.INPUT_MODE.NUMERIC}
                />
                <View style={[styles.flexRow, styles.mt4]}>
                    <View style={[styles.flex1, styles.mr2]}>
                        <InputWrapper
                            // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/31972) is migrated to TypeScript.
                            InputComponent={TextInput}
                            inputID="expirationDate"
                            label={translate('addDebitCardPage.expiration')}
                            aria-label={translate('addDebitCardPage.expiration')}
                            role={CONST.ROLE.PRESENTATION}
                            placeholder={translate('addDebitCardPage.expirationDate')}
                            inputMode={CONST.INPUT_MODE.NUMERIC}
                            maxLength={4}
                        />
                    </View>
                    <View style={[styles.flex1]}>
                        <InputWrapper
                            // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/31972) is migrated to TypeScript.
                            InputComponent={TextInput}
                            inputID="securityCode"
                            label={translate('addDebitCardPage.cvv')}
                            aria-label={translate('addDebitCardPage.cvv')}
                            role={CONST.ROLE.PRESENTATION}
                            maxLength={4}
                            inputMode={CONST.INPUT_MODE.NUMERIC}
                        />
                    </View>
                </View>
                <View>
                    <InputWrapper
                        // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/31972) is migrated to TypeScript.
                        InputComponent={AddressSearch}
                        inputID="addressStreet"
                        label={translate('addDebitCardPage.billingAddress')}
                        containerStyles={[styles.mt4]}
                        maxInputLength={CONST.FORM_CHARACTER_LIMIT}
                        // Limit the address search only to the USA until we fully can support international debit cards
                        isLimitedToUSA
                    />
                </View>
                <InputWrapper
                    // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/31972) is migrated to TypeScript.
                    InputComponent={TextInput}
                    inputID="addressZipCode"
                    label={translate('common.zip')}
                    aria-label={translate('common.zip')}
                    role={CONST.ROLE.PRESENTATION}
                    inputMode={CONST.INPUT_MODE.NUMERIC}
                    maxLength={CONST.BANK_ACCOUNT.MAX_LENGTH.ZIP_CODE}
                    hint={translate('common.zipCodeExampleFormat', {zipSampleFormat: CONST.COUNTRY_ZIP_REGEX_DATA.US.samples})}
                    containerStyles={[styles.mt4]}
                />
                <View style={[styles.mt4, styles.mhn5]}>
                    <InputWrapper
                        // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/31972) is migrated to TypeScript.
                        InputComponent={StatePicker}
                        inputID="addressState"
                    />
                </View>
                <InputWrapper
                    // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/31972) is migrated to TypeScript.
                    InputComponent={CheckboxWithLabel}
                    accessibilityLabel={`${translate('common.iAcceptThe')} ${translate('common.expensifyTermsOfService')}`}
                    inputID="acceptTerms"
                    defaultValue={false}
                    LabelComponent={() => (
                        <Text>
                            {`${translate('common.iAcceptThe')}`}
                            <TextLink href={CONST.TERMS_URL}>{`${translate('common.expensifyTermsOfService')}`}</TextLink>
                        </Text>
                    )}
                    style={[styles.mt4]}
                />
            </FormProvider>
        </ScreenWrapper>
    );
}

DebitCardPage.displayName = 'DebitCardPage';

export default withOnyx<DebitCardPageProps, DebitCardPageOnyxProps>({
    formData: {
        key: ONYXKEYS.FORMS.ADD_DEBIT_CARD_FORM,
    },
})(DebitCardPage);
