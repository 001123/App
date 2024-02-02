import React, {useEffect} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import Button from '@components/Button';
import FixedFooter from '@components/FixedFooter';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import {MushroomTopHat} from '@components/Icon/Illustrations';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@navigation/Navigation';
import * as ExitSurvey from '@userActions/ExitSurvey';
import * as Link from '@userActions/Link';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import ExitSurveyOffline from './ExitSurveyOffline';

type ExitSurveyConfirmPageOnyxProps = {
    isLoading: OnyxEntry<boolean>;
};

function ExitSurveyConfirmPage({isLoading}: ExitSurveyConfirmPageOnyxProps) {
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();
    const styles = useThemeStyles();

    useEffect(() => {
        if (!isOffline) {
            return;
        }
        Navigation.navigate(ROUTES.SETTINGS_EXIT_SURVEY_REASON);
    }, [isOffline]);

    return (
        <ScreenWrapper testID={ExitSurveyConfirmPage.displayName}>
            <HeaderWithBackButton
                title={translate('exitSurvey.header')}
                onBackButtonPress={() => Navigation.goBack()}
            />
            {isOffline && <ExitSurveyOffline />}
            {!isOffline && (
                <View style={[styles.flex1, styles.justifyContentCenter, styles.alignItemsCenter, styles.p5]}>
                    <MushroomTopHat />
                    <Text style={[styles.headerAnonymousFooter, styles.mt5]}>{translate('exitSurvey.thankYou')}</Text>
                    <Text style={[styles.mt2]}>{translate('exitSurvey.thankYouSubtitle')}</Text>
                </View>
            )}
            <FixedFooter>
                <Button
                    success
                    text={translate('exitSurvey.goToExpensifyClassic')}
                    onPress={() => {
                        ExitSurvey.switchToOldDot();
                        Link.openOldDotLink(CONST.OLDDOT_URLS.INBOX);
                    }}
                    isLoading={isLoading ?? false}
                    isDisabled={isOffline}
                />
            </FixedFooter>
        </ScreenWrapper>
    );
}

ExitSurveyConfirmPage.displayName = 'ExitSurveyConfirmPage';

export default withOnyx<ExitSurveyConfirmPageOnyxProps, ExitSurveyConfirmPageOnyxProps>({
    isLoading: {
        key: ONYXKEYS.IS_SWITCHING_TO_OLD_DOT,
    },
})(ExitSurveyConfirmPage);
