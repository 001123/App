import React from 'react';
import {View} from 'react-native';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import MenuItem from '@components/MenuItem';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import SpacerView from '@components/SpacerView';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useWaitForNavigation from '@hooks/useWaitForNavigation';
import Navigation from '@libs/Navigation/Navigation';
import withPolicy from '@pages/workspace/withPolicy';
import type {WithPolicyProps} from '@pages/workspace/withPolicy';
import ToggleSettingOptionRow from '@pages/workspace/workflows/ToggleSettingsOptionRow';
import * as Policy from '@userActions/Policy';
import ROUTES from '@src/ROUTES';
import CONST from '@src/CONST';

function QuickbooksAdvancedPage({policy}: WithPolicyProps) {
    const styles = useThemeStyles();
    const waitForNavigate = useWaitForNavigation();
    const {translate} = useLocalize();

    const policyID = policy?.id ?? '';
    const {autoSync, syncPeople, autoCreateVendor} = policy?.connections?.quickbooksOnline?.config ?? {};

    const qboSyncToggleSettings = [
        {
            title: translate('workspace.qbo.advancedConfig.autoSync'),
            subTitle: translate('workspace.qbo.advancedConfig.autoSyncDescription'),
            isActive: Boolean(autoSync),
            onToggle: () => Policy.updatePolicyConnectionConfig(
                policyID,
                CONST.QUICK_BOOKS_CONFIG.AUTO_SYNC,
                !autoSync,
            ),
        },
        {
            title: translate('workspace.qbo.advancedConfig.inviteEmployees'),
            subTitle: translate('workspace.qbo.advancedConfig.inviteEmployeesDescription'),
            isActive: Boolean(syncPeople),
            onToggle: () => Policy.updatePolicyConnectionConfig(
                policyID,
                CONST.QUICK_BOOKS_CONFIG.SYNCE_PEOPLE,
                !syncPeople,
            ),
        },
        {
            title: translate('workspace.qbo.advancedConfig.createEntities'),
            subTitle: translate('workspace.qbo.advancedConfig.createEntitiesDescription'),
            isActive: Boolean(autoCreateVendor),
            onToggle: () => Policy.updatePolicyConnectionConfig(
                policyID,
                CONST.QUICK_BOOKS_CONFIG.AUTO_CREATE_VENDOR,
                !autoCreateVendor,
            ),
        },
    ];

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
            testID={QuickbooksAdvancedPage.displayName}
        >
            <HeaderWithBackButton title={translate('workspace.qbo.advancedConfig.advanced')} />

            <ScrollView contentContainerStyle={[styles.pb2, styles.ph5]}>
                {qboSyncToggleSettings.map((item) => (
                    <View
                        style={styles.mv3}
                        key={item.title}
                    >
                        <ToggleSettingOptionRow
                            title={item.title}
                            subtitle={item.subTitle}
                            isActive={item.isActive}
                            onToggle={item.onToggle}
                        />
                    </View>
                ))}

                <View style={styles.mv3}>
                    <SpacerView
                        shouldShow
                        style={[styles.chatItemComposeBoxColor]}
                    />
                </View>

                <View style={styles.mv3}>
                    <ToggleSettingOptionRow
                        title={translate('workspace.qbo.advancedConfig.reimbursedReports')}
                        subtitle={translate('workspace.qbo.advancedConfig.reimbursedReportsDescription')}
                        isActive
                        onToggle={() => {}}
                    />
                </View>
                <OfflineWithFeedback>
                    <MenuItemWithTopDescription
                        shouldShowRightIcon
                        title={translate('workspace.qbo.advancedConfig.croissantCo.CroissantCoPayrollAccount')}
                        description={translate('workspace.qbo.advancedConfig.qboAccount')}
                        wrapperStyle={[styles.sectionMenuItemTopDescription]}
                        onPress={waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_ACCOUNTING_QUICKBOOKS_ONLINE_ACCOUNT_SELECTOR.getRoute(policyID)))}
                    />
                </OfflineWithFeedback>

                <View style={styles.mv3}>
                    <SpacerView
                        shouldShow
                        style={[styles.chatItemComposeBoxColor]}
                    />
                </View>

                <MenuItem
                    title={translate('workspace.qbo.advancedConfig.collectionAccount')}
                    description={translate('workspace.qbo.advancedConfig.collectionAccountDescription')}
                    descriptionTextStyle={[styles.pr9]}
                    wrapperStyle={[styles.sectionMenuItemTopDescription]}
                    interactive={false}
                />

                <MenuItem
                    title={translate('workspace.qbo.advancedConfig.croissantCo.CroissantCoMoneyInClearing')}
                    shouldShowRightIcon
                    shouldShowBasicTitle
                    wrapperStyle={[styles.sectionMenuItemTopDescription]}
                    onPress={waitForNavigate(() => Navigation.navigate(ROUTES.WORKSPACE_ACCOUNTING_QUICKBOOKS_ONLINE_INVOICE_ACCOUNT_SELECTOR.getRoute(policyID)))}
                />
            </ScrollView>
        </ScreenWrapper>
    );
}

QuickbooksAdvancedPage.displayName = 'QuickbooksAdvancedPage';

export default withPolicy(QuickbooksAdvancedPage);
