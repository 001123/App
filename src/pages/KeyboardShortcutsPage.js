import React from 'react';
import {View, ScrollView} from 'react-native';
import _ from 'underscore';
import Navigation from '../libs/Navigation/Navigation';
import HeaderWithBackButton from '../components/HeaderWithBackButton';
import ScreenWrapper from '../components/ScreenWrapper';
import Text from '../components/Text';
import styles from '../styles/styles';
import CONST from '../CONST';
import useLocalize from '../hooks/useLocalize';
import KeyboardShortcut from '../libs/KeyboardShortcut';

function KeyboardShortcutsPage() {
    const {translate} = useLocalize();
    const shortcuts = _.chain(CONST.KEYBOARD_SHORTCUTS)
        .filter((shortcut) => !_.isEmpty(shortcut.descriptionKey))
        .map((shortcut) => {
            const platformAdjustedModifiers = KeyboardShortcut.getPlatformEquivalentForKeys(shortcut.modifiers);
            return {
                displayName: KeyboardShortcut.getDisplayName(shortcut.shortcutKey, platformAdjustedModifiers),
                descriptionKey: shortcut.descriptionKey,
            };
        })
        .value();

    /**
     * Render the information of a single shortcut
     * @param {Object} shortcut
     * @param {String} shortcut.displayName
     * @param {String} shortcut.descriptionKey
     * @returns {React.Component}
     */
    const renderShortcut = (shortcut) => (
        <View
            key={shortcut.displayName}
            style={styles.mb5}
        >
            <View style={styles.mb1}>
                <Text style={styles.textStrong}>{shortcut.displayName}</Text>
            </View>
            <View>
                <Text style={styles.textLabelSupporting}>{translate(`keyboardShortcutsPage.shortcuts.${shortcut.descriptionKey}`)}</Text>
            </View>
        </View>
    );

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            testID={KeyboardShortcutsPage.displayName}
        >
            <HeaderWithBackButton
                title={translate('keyboardShortcutsPage.title')}
                onBackButtonPress={() => Navigation.goBack()}
            />
            <ScrollView contentContainerStyle={styles.flexGrow1}>
                <View style={[styles.pageWrapper, styles.alignItemsStart]}>
                    <Text style={[styles.mb5, styles.baseFontStyle]}>{translate('keyboardShortcutsPage.subtitle')}</Text>
                    {_.map(shortcuts, renderShortcut)}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}

KeyboardShortcutsPage.displayName = 'KeyboardShortcutsPage';

export default KeyboardShortcutsPage;
