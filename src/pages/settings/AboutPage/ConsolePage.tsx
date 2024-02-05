import {FlashList} from '@shopify/flash-list';
import React, {useEffect, useState} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import Button from '@components/Button';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import addLog from '@libs/actions/Console';
import {createLog, sanitizeConsoleInput} from '@libs/Console';
import type {Log} from '@libs/Console';
import localFileDownload from '@libs/localFileDownload';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

type CapturedLogs = Record<number, Log>;

type ConsolePageProps = {
    capturedLogs: CapturedLogs;
};

type ConsolePageOnyxProps = {
    /** Logs captured on the current device */
    capturedLogs: OnyxEntry<CapturedLogs>;
};

function ConsolePage({capturedLogs}: ConsolePageProps) {
    const [input, setInput] = useState('');
    const [logs, setLogs] = useState<CapturedLogs>(capturedLogs);
    const {translate} = useLocalize();
    const styles = useThemeStyles();

    useEffect(() => {
        setLogs((prevLogs) => ({...prevLogs, ...capturedLogs}));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [capturedLogs]);

    const handleExecute = () => {
        const sanitizedInput = sanitizeConsoleInput(input);

        const customLogs = createLog(sanitizedInput);
        customLogs.forEach((log) => addLog(log));
        setInput('');
    };

    const saveLogs = () => {
        const logsWithParsedMessages = Object.values(logs).map((log) => {
            try {
                const parsedMessage = JSON.parse(log.message);
                return {
                    ...log,
                    message: parsedMessage,
                };
            } catch {
                // If the message can't be parsed, just return the original log
                return log;
            }
        });

        localFileDownload('logs', JSON.stringify(logsWithParsedMessages, null, 2), 'File was saved in your Downloads folder.');
    };

    return (
        <ScreenWrapper testID={ConsolePage.displayName}>
            <HeaderWithBackButton
                title={translate('initialSettingsPage.troubleshoot.debugConsole')}
                onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS_TROUBLESHOOT)}
            />
            <View style={[styles.border, styles.highlightBG, styles.borderNone, styles.mh5, {height: CONST.DEBUG_CONSOLE.CONSOLE_HEIGHT}]}>
                {logs !== undefined && (
                    <FlashList
                        data={Object.values(logs).reverse()}
                        renderItem={({item}) => (
                            <View style={styles.mb2}>
                                <Text family="MONOSPACE">{`${item.time.toLocaleTimeString()} ${item.message}`}</Text>
                            </View>
                        )}
                        estimatedItemSize={70}
                        contentContainerStyle={styles.p5}
                        inverted
                    />
                )}
            </View>
            <View style={[styles.flex1, styles.flexRow, styles.flexShrink1, styles.m5]}>
                <Button
                    text={translate('initialSettingsPage.debugConsole.saveLog')}
                    onPress={saveLogs}
                    icon={Expensicons.Download}
                    style={[styles.flex1, styles.mr1]}
                />
                <Button
                    text={translate('initialSettingsPage.debugConsole.shareLog')}
                    onPress={() => {}}
                    icon={Expensicons.Upload}
                    style={[styles.flex1, styles.ml1]}
                />
            </View>
            <View style={[styles.mh5]}>
                <TextInput
                    onChangeText={setInput}
                    value={input}
                    placeholder={translate('initialSettingsPage.debugConsole.enterCommand')}
                    autoGrowHeight
                    autoCorrect={false}
                    accessibilityRole="text"
                />
                <Button
                    success
                    text={translate('initialSettingsPage.debugConsole.execute')}
                    onPress={handleExecute}
                    style={[styles.mt5]}
                />
            </View>
        </ScreenWrapper>
    );
}

ConsolePage.displayName = 'ConsolePage';

export default withOnyx<ConsolePageProps, ConsolePageOnyxProps>({
    capturedLogs: {
        key: ONYXKEYS.LOGS,
    },
})(ConsolePage);
