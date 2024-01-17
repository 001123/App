import type {CONST as COMMON_CONST} from 'expensify-common/lib/CONST';
import React, {useCallback} from 'react';
import {View} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import type * as Localize from '@libs/Localize';
import Navigation from '@libs/Navigation/Navigation';
import * as ValidationUtils from '@libs/ValidationUtils';
import CONST from '@src/CONST';
import type {OnyxFormKey} from '@src/ONYXKEYS';
import type {AddressForm as AddressFormValues} from '@src/types/onyx';
import AddressSearch from './AddressSearch';
import CountrySelector from './CountrySelector';
import FormProvider from './Form/FormProvider';
import InputWrapper from './Form/InputWrapper';
import StatePicker from './StatePicker';
import TextInput from './TextInput';

type AddressFormProps = {
    /** Address city field */
    city?: string;

    /** Address country field */
    country?: keyof typeof CONST.COUNTRY_ZIP_REGEX_DATA | '';

    /** Address state field */
    state?: keyof typeof COMMON_CONST.STATES | '';

    /** Address street line 1 field */
    street1?: string;

    /** Address street line 2 field */
    street2?: string;

    /** Address zip code field */
    zip?: string;

    /** Callback which is executed when the user changes address, city or state */
    onAddressChanged?: (data: string, key: string) => void;

    /** Callback which is executed when the user submits his address changes */
    onSubmit: () => void;

    /** Whether or not should the form data should be saved as draft */
    shouldSaveDraft?: boolean;

    /** Text displayed on the bottom submit button */
    submitButtonText?: string;

    /** A unique Onyx key identifying the form */
    formID: OnyxFormKey;
};

type ValidatorErrors = {
    addressLine1?: string;
    city?: string;
    country?: string;
    state?: string;
    zipPostCode?: Localize.MaybePhraseKey;
};

function AddressForm({
    city = '',
    country = '',
    formID,
    onAddressChanged = () => {},
    onSubmit,
    shouldSaveDraft = false,
    state = '',
    street1 = '',
    street2 = '',
    submitButtonText = '',
    zip = '',
}: AddressFormProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    let zipSampleFormat = '';

    if (country) {
        const countryData = CONST.COUNTRY_ZIP_REGEX_DATA[country];
        if (countryData && 'samples' in countryData) {
            zipSampleFormat = countryData.samples;
        }
    }

    const zipFormat = translate('common.zipCodeExampleFormat', {zipSampleFormat});
    const isUSAForm = country === CONST.COUNTRY.US;

    /**
     * @param translate - translate function
     * @param isUSAForm - selected country ISO code is US
     * @param values - form input values
     * @returns - An object containing the errors for each inputID
     */

    const validator = useCallback((values: AddressFormValues): ValidatorErrors => {
        const errors: ValidatorErrors = {};
        const requiredFields = ['addressLine1', 'city', 'country', 'state'] as const;

        // Check "State" dropdown is a valid state if selected Country is USA
        if (values.country === CONST.COUNTRY.US && !values.state) {
            errors.state = 'common.error.fieldRequired';
        }

        // Add "Field required" errors if any required field is empty
        requiredFields.forEach((fieldKey) => {
            const fieldValue = values[fieldKey] ?? '';
            if (ValidationUtils.isRequiredFulfilled(fieldValue)) {
                return;
            }

            errors[fieldKey] = 'common.error.fieldRequired';
        });

        // If no country is selected, default value is an empty string and there's no related regex data so we default to an empty object
        const countryRegexDetails = values.country ? CONST.COUNTRY_ZIP_REGEX_DATA[values.country] : {};

        // The postal code system might not exist for a country, so no regex either for them.
        let countrySpecificZipRegex;
        let countryZipFormat;

        if ('regex' in countryRegexDetails) {
            countrySpecificZipRegex = countryRegexDetails.regex as RegExp;
        }

        if ('samples' in countryRegexDetails) {
            countryZipFormat = countryRegexDetails.samples as string;
        }

        if (countrySpecificZipRegex) {
            if (!countrySpecificZipRegex.test(values.zipPostCode.trim().toUpperCase())) {
                if (ValidationUtils.isRequiredFulfilled(values.zipPostCode.trim())) {
                    errors.zipPostCode = ['privatePersonalDetails.error.incorrectZipFormat', {zipFormat: countryZipFormat ?? ''}];
                } else {
                    errors.zipPostCode = 'common.error.fieldRequired';
                }
            }
        } else if (!CONST.GENERIC_ZIP_CODE_REGEX.test(values.zipPostCode.trim().toUpperCase())) {
            errors.zipPostCode = 'privatePersonalDetails.error.incorrectZipFormat';
        }

        return errors;
    }, []);

    return (
        // @ts-expect-error TODO: Remove this once FormProvider (https://github.com/Expensify/App/issues/25109) is migrated to TypeScript.
        <FormProvider
            style={[styles.flexGrow1, styles.mh5]}
            formID={formID}
            validate={validator}
            onSubmit={onSubmit}
            submitButtonText={submitButtonText}
            enabledWhenOffline
        >
            <View>
                <InputWrapper
                    // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/25109) is migrated to TypeScript.
                    InputComponent={AddressSearch}
                    inputID="addressLine1"
                    label={translate('common.addressLine', {lineNumber: 1})}
                    onValueChange={(data: string, key: string) => {
                        onAddressChanged(data, key);
                        // This enforces the country selector to use the country from address instead of the country from URL
                        Navigation.setParams({country: undefined});
                    }}
                    defaultValue={street1}
                    renamedInputKeys={{
                        street: 'addressLine1',
                        street2: 'addressLine2',
                        city: 'city',
                        state: 'state',
                        zipCode: 'zipPostCode',
                        country: 'country',
                    }}
                    maxInputLength={CONST.FORM_CHARACTER_LIMIT}
                    shouldSaveDraft={shouldSaveDraft}
                />
            </View>
            <View style={styles.formSpaceVertical} />
            <InputWrapper
                // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/25109) is migrated to TypeScript.
                InputComponent={TextInput}
                inputID="addressLine2"
                label={translate('common.addressLine', {lineNumber: 2})}
                aria-label={translate('common.addressLine', {lineNumber: 2})}
                role={CONST.ROLE.PRESENTATION}
                defaultValue={street2}
                maxLength={CONST.FORM_CHARACTER_LIMIT}
                spellCheck={false}
                shouldSaveDraft={shouldSaveDraft}
            />
            <View style={styles.formSpaceVertical} />
            <View style={styles.mhn5}>
                <InputWrapper
                    // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/25109) is migrated to TypeScript.
                    InputComponent={CountrySelector}
                    inputID="country"
                    value={country}
                    shouldSaveDraft={shouldSaveDraft}
                />
            </View>
            <View style={styles.formSpaceVertical} />
            {isUSAForm ? (
                <View style={styles.mhn5}>
                    <InputWrapper
                        // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/25109) is migrated to TypeScript.
                        InputComponent={StatePicker}
                        inputID="state"
                        defaultValue={state}
                        onValueChange={onAddressChanged}
                        shouldSaveDraft={shouldSaveDraft}
                    />
                </View>
            ) : (
                <InputWrapper
                    // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/25109) is migrated to TypeScript.
                    InputComponent={TextInput}
                    inputID="state"
                    label={translate('common.stateOrProvince')}
                    aria-label={translate('common.stateOrProvince')}
                    role={CONST.ROLE.PRESENTATION}
                    value={state}
                    maxLength={CONST.FORM_CHARACTER_LIMIT}
                    spellCheck={false}
                    onValueChange={onAddressChanged}
                    shouldSaveDraft={shouldSaveDraft}
                />
            )}
            <View style={styles.formSpaceVertical} />
            <InputWrapper
                // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/25109) is migrated to TypeScript.
                InputComponent={TextInput}
                inputID="city"
                label={translate('common.city')}
                aria-label={translate('common.city')}
                role={CONST.ROLE.PRESENTATION}
                defaultValue={city}
                maxLength={CONST.FORM_CHARACTER_LIMIT}
                spellCheck={false}
                onValueChange={onAddressChanged}
                shouldSaveDraft={shouldSaveDraft}
            />
            <View style={styles.formSpaceVertical} />
            <InputWrapper
                // @ts-expect-error TODO: Remove this once InputWrapper (https://github.com/Expensify/App/issues/25109) is migrated to TypeScript.
                InputComponent={TextInput}
                inputID="zipPostCode"
                label={translate('common.zipPostCode')}
                aria-label={translate('common.zipPostCode')}
                role={CONST.ROLE.PRESENTATION}
                autoCapitalize="characters"
                defaultValue={zip}
                maxLength={CONST.BANK_ACCOUNT.MAX_LENGTH.ZIP_CODE}
                hint={zipFormat}
                onValueChange={onAddressChanged}
                shouldSaveDraft={shouldSaveDraft}
            />
        </FormProvider>
    );
}

AddressForm.displayName = 'AddressForm';

export default AddressForm;
