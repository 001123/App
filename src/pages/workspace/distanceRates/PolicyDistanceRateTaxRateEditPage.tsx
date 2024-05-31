import type {StackScreenProps} from '@react-navigation/stack';
import React, {useMemo} from 'react';
import {Keyboard} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import SelectionList from '@components/SelectionList';
import RadioListItem from '@components/SelectionList/RadioListItem';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import type {SettingsNavigatorParamList} from '@navigation/types';
import AccessOrNotFoundWrapper from '@pages/workspace/AccessOrNotFoundWrapper';
import * as Policy from '@userActions/Policy/Policy';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';

type ListItemType = {
    value: string;
    text: string;
    isSelected: boolean;
    keyForList: string;
};

type PolicyDistanceRateTaxRateEditPageOnyxProps = {
    /** Policy details */
    policy: OnyxEntry<OnyxTypes.Policy>;
};

type PolicyDistanceRateTaxRateEditPageProps = PolicyDistanceRateTaxRateEditPageOnyxProps & StackScreenProps<SettingsNavigatorParamList, typeof SCREENS.WORKSPACE.DISTANCE_RATE_TAX_RATE_EDIT>;

function PolicyDistanceRateTaxRateEditPage({policy, route}: PolicyDistanceRateTaxRateEditPageProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const policyID = route.params.policyID;
    const rateID = route.params.rateID;
    const customUnits = policy?.customUnits ?? {};
    const customUnit = customUnits[Object.keys(customUnits)[0]];
    const rate = customUnit?.rates[rateID];
    const taxRateExternalID = rate.attributes?.taxRateExternalID;
    const taxRateItems: ListItemType[] = useMemo(() => {
        const taxes = policy?.taxRates?.taxes;
        const result = Object.entries(taxes ?? {}).map(([key, value]) => ({
            value: key,
            text: `${value.name} (${value.value})`,
            isSelected: taxRateExternalID === key,
            keyForList: key,
        }));
        return result;
    }, [policy, taxRateExternalID]);

    const onTaxRateChange = (newTaxRate: ListItemType) => {
        Policy.updateDistanceTaxRate(policyID, customUnit, [
            {
                ...rate,
                attributes: {
                    ...rate.attributes,
                    taxRateExternalID: newTaxRate.value,
                },
            },
        ]);
        Keyboard.dismiss();
        Navigation.navigate(ROUTES.WORKSPACE_DISTANCE_RATE_DETAILS.getRoute(policyID, rateID));
    };

    return (
        <AccessOrNotFoundWrapper
            accessVariants={[CONST.POLICY.ACCESS_VARIANTS.ADMIN, CONST.POLICY.ACCESS_VARIANTS.PAID]}
            policyID={policyID}
            featureName={CONST.POLICY.MORE_FEATURES.ARE_DISTANCE_RATES_ENABLED}
        >
            <ScreenWrapper
                includeSafeAreaPaddingBottom={false}
                style={[styles.defaultModalContainer]}
                shouldEnableMaxHeight
                testID={PolicyDistanceRateTaxRateEditPage.displayName}
            >
                <HeaderWithBackButton
                    title={translate('workspace.taxes.taxRate')}
                    shouldShowBackButton
                    onBackButtonPress={() => Navigation.goBack()}
                />
                <SelectionList
                    sections={[{data: taxRateItems}]}
                    ListItem={RadioListItem}
                    onSelectRow={onTaxRateChange}
                    initiallyFocusedOptionKey={taxRateItems.find((item) => item.isSelected)?.keyForList}
                />
            </ScreenWrapper>
        </AccessOrNotFoundWrapper>
    );
}

PolicyDistanceRateTaxRateEditPage.displayName = 'PolicyDistanceRateTaxRateEditPage';

export default withOnyx<PolicyDistanceRateTaxRateEditPageProps, PolicyDistanceRateTaxRateEditPageOnyxProps>({
    policy: {
        key: ({route}) => `${ONYXKEYS.COLLECTION.POLICY}${route.params.policyID}`,
    },
})(PolicyDistanceRateTaxRateEditPage);
