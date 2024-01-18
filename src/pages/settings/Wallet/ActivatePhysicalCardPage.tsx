import type {StackScreenProps} from '@react-navigation/stack';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import {OnyxEntry, withOnyx} from 'react-native-onyx';
import BigNumberPad from '@components/BigNumberPad';
import Button from '@components/Button';
import IllustratedHeaderPageLayout from '@components/IllustratedHeaderPageLayout';
import LottieAnimations from '@components/LottieAnimations';
import MagicCodeInput from '@components/MagicCodeInput';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import * as CardUtils from '@libs/CardUtils';
import * as DeviceCapabilities from '@libs/DeviceCapabilities';
import * as ErrorUtils from '@libs/ErrorUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {PublicScreensParamList} from '@libs/Navigation/types';
import NotFoundPage from '@pages/ErrorPage/NotFoundPage';
import * as CardSettings from '@userActions/Card';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {Card} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

type ActivatePhysicalCardPageOnyxProps = {
    /** Card list propTypes */
    cardList: OnyxEntry<Record<string, Card>>;
};

type ActivatePhysicalCardPageProps = ActivatePhysicalCardPageOnyxProps & StackScreenProps<PublicScreensParamList, typeof SCREENS.TRANSITION_BETWEEN_APPS>;

const LAST_FOUR_DIGITS_LENGTH = 4;
const MAGIC_INPUT_MIN_HEIGHT = 86;

function ActivatePhysicalCardPage({
    cardList = {},
    route: {
        params: {domain = ''},
    },
}: ActivatePhysicalCardPageProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {isExtraSmallScreenHeight} = useWindowDimensions();
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();

    const [formError, setFormError] = useState('');
    const [lastFourDigits, setLastFourDigits] = useState('');
    const [lastPressedDigit, setLastPressedDigit] = useState('');

    const domainCards = CardUtils.getDomainCards(cardList ?? {})[domain];
    const physicalCard = domainCards.find((card) => card.isVirtual);
    const cardID = physicalCard?.cardID ?? 0;
    const cardError = ErrorUtils.getLatestErrorMessage(physicalCard ?? {});

    const activateCardCodeInputRef = useRef(null);

    /**
     * If state of the card is CONST.EXPENSIFY_CARD.STATE.OPEN, navigate to card details screen.
     */
    useEffect(() => {
        if (physicalCard?.isLoading || (cardList && cardList[cardID]?.state !== CONST.EXPENSIFY_CARD.STATE.OPEN)) {
            return;
        }

        Navigation.navigate(ROUTES.SETTINGS_WALLET_DOMAINCARD.getRoute(domain));
    }, [cardID, cardList, domain, physicalCard?.isLoading]);

    useEffect(
        () => () => {
            CardSettings.clearCardListErrors(cardID);
        },
        [cardID],
    );

    /**
     * Update lastPressedDigit with value that was pressed on BigNumberPad.
     *
     * NOTE: If the same digit is pressed twice in a row, append it to the end of the string
     * so that useEffect inside MagicCodeInput will be triggered by artificial change of the value.
     */
    const updateLastPressedDigit = useCallback((key: string) => setLastPressedDigit(lastPressedDigit === key ? lastPressedDigit + key : key), [lastPressedDigit]);

    /**
     * Handle card activation code input
     */
    const onCodeInput = (text: string) => {
        setFormError('');

        if (cardError) {
            CardSettings.clearCardListErrors(cardID);
        }

        setLastFourDigits(text);
    };

    const submitAndNavigateToNextPage = useCallback(() => {
        // @ts-expect-error TODO: Remove this once MagicCodeInput (https://github.com/Expensify/App/issues/25078) is migrated to TypeScript.
        activateCardCodeInputRef.current?.blur();

        if (lastFourDigits.replace(CONST.MAGIC_CODE_EMPTY_CHAR, '').length !== LAST_FOUR_DIGITS_LENGTH) {
            setFormError(translate('activateCardPage.error.thatDidntMatch'));
            return;
        }

        CardSettings.activatePhysicalExpensifyCard(lastFourDigits, cardID);
    }, [lastFourDigits, cardID, translate]);

    if (isEmptyObject(physicalCard)) {
        return <NotFoundPage />;
    }

    return (
        <IllustratedHeaderPageLayout
            title={translate('activateCardPage.activateCard')}
            onBackButtonPress={() => Navigation.navigate(ROUTES.SETTINGS_WALLET_DOMAINCARD.getRoute(domain))}
            backgroundColor={theme.PAGE_THEMES[SCREENS.SETTINGS.PREFERENCES.ROOT].backgroundColor}
            illustration={LottieAnimations.Magician}
            scrollViewContainerStyles={[styles.mnh100]}
            childrenContainerStyles={[styles.flex1]}
        >
            <Text style={[styles.mh5, styles.textHeadline]}>{translate('activateCardPage.pleaseEnterLastFour')}</Text>
            <View style={[styles.mh5, {minHeight: MAGIC_INPUT_MIN_HEIGHT}]}>
                <MagicCodeInput
                    // @ts-expect-error TODO: Remove this once MagicCodeInput (https://github.com/Expensify/App/issues/25078) is migrated to TypeScript.
                    isDisableKeyboard
                    autoComplete="off"
                    maxLength={LAST_FOUR_DIGITS_LENGTH}
                    name="activateCardCode"
                    value={lastFourDigits}
                    lastPressedDigit={lastPressedDigit}
                    onChangeText={onCodeInput}
                    onFulfill={submitAndNavigateToNextPage}
                    errorText={formError || cardError}
                    ref={activateCardCodeInputRef}
                />
            </View>
            <View style={[styles.w100, styles.justifyContentEnd, styles.pageWrapper, styles.pv0]}>
                {DeviceCapabilities.canUseTouchScreen() && <BigNumberPad numberPressed={updateLastPressedDigit} />}
            </View>
            <Button
                success
                isDisabled={isOffline}
                isLoading={physicalCard?.isLoading}
                medium={isExtraSmallScreenHeight}
                style={[styles.w100, styles.p5, styles.mtAuto]}
                onPress={submitAndNavigateToNextPage}
                pressOnEnter
                text={translate('activateCardPage.activatePhysicalCard')}
            />
        </IllustratedHeaderPageLayout>
    );
}

ActivatePhysicalCardPage.displayName = 'ActivatePhysicalCardPage';

export default withOnyx<ActivatePhysicalCardPageProps, ActivatePhysicalCardPageOnyxProps>({
    cardList: {
        key: ONYXKEYS.CARD_LIST,
    },
})(ActivatePhysicalCardPage);
