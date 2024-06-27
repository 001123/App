import React, {useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import Button from '@components/Button';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import Popover from '@components/Popover';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import getClickedTargetLocation from '@libs/getClickedTargetLocation';
import variables from '@styles/variables';
import * as Report from '@userActions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

type WorkspaceCardsListLabelProps = {
    /** Label type */
    type: ValueOf<typeof CONST.WORKSPACE_CARDS_LIST_LABEL_TYPE>;

    /** Label value */
    value: number;

    /** Additional style props */
    style?: StyleProp<ViewStyle>;
};

function WorkspaceCardsListLabel({type, value, style}: WorkspaceCardsListLabelProps) {
    const styles = useThemeStyles();
    const {windowWidth} = useWindowDimensions();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const theme = useTheme();
    const {translate} = useLocalize();
    const [bankAccountList] = useOnyx(ONYXKEYS.BANK_ACCOUNT_LIST);
    const [isVisible, setVisible] = useState(false);
    const [anchorPosition, setAnchorPosition] = useState({top: 0, left: 0});
    const anchorRef = useRef(null);

    const isConnectedWithPlaid = useMemo(() => !!Object.values(bankAccountList ?? {})[0]?.accountData?.additionalData?.plaidAccountID, [bankAccountList]);

    useEffect(() => {
        if (!anchorRef.current || !isVisible) {
            return;
        }

        const position = getClickedTargetLocation(anchorRef.current);
        const BOTTOM_MARGIN_OFFSET = 3;

        setAnchorPosition({
            top: position.top + position.height + BOTTOM_MARGIN_OFFSET,
            left: position.left,
        });
    }, [isVisible, windowWidth]);

    const requestLimitIncrease = () => {
        // TODO: uncomment code below when API call is supported
        // Policy.requestExpensifyCardLimitIncrease(settlementBankAccountID);
        setVisible(false);
        Report.navigateToConciergeChat();
    };

    return (
        <View style={styles.flex1}>
            <View
                ref={anchorRef}
                style={[styles.flexRow, styles.alignItemsCenter, styles.mb1, style]}
            >
                <Text style={[styles.mutedNormalTextLabel, styles.mr1]}>{translate(`workspace.expensifyCard.${type}`)}</Text>
                <PressableWithFeedback
                    accessibilityLabel={translate(`workspace.expensifyCard.${type}`)}
                    accessibilityRole={CONST.ROLE.BUTTON}
                    onPress={() => setVisible(true)}
                >
                    <Icon
                        src={Expensicons.Info}
                        width={variables.fontSizeLabel}
                        height={variables.fontSizeLabel}
                        fill={theme.icon}
                    />
                </PressableWithFeedback>
            </View>

            <Text style={styles.shortTermsHeadline}>{CurrencyUtils.convertToDisplayString(value, 'USD')}</Text>

            <Popover
                onClose={() => setVisible(false)}
                isVisible={isVisible}
                outerStyle={!shouldUseNarrowLayout ? styles.pr5 : undefined}
                innerContainerStyle={!shouldUseNarrowLayout ? {maxWidth: variables.modalContentMaxWidth} : undefined}
                anchorRef={anchorRef}
                anchorPosition={anchorPosition}
            >
                <View style={styles.p4}>
                    <Text
                        numberOfLines={1}
                        style={[styles.optionDisplayName, styles.sidebarLinkTextBold, styles.mb2]}
                    >
                        {translate(`workspace.expensifyCard.${type}`)}
                    </Text>
                    <Text style={[styles.textLabelSupporting, styles.lh16]}>{translate(`workspace.expensifyCard.${type}Description`)}</Text>

                    {!isConnectedWithPlaid && type === CONST.WORKSPACE_CARDS_LIST_LABEL_TYPE.REMAINING_LIMIT && (
                        <View style={[styles.flexRow, styles.mt2]}>
                            <Button
                                medium
                                onPress={requestLimitIncrease}
                                text={translate('workspace.expensifyCard.requestLimitIncrease')}
                                style={shouldUseNarrowLayout && styles.flex1}
                            />
                        </View>
                    )}
                </View>
            </Popover>
        </View>
    );
}

export default WorkspaceCardsListLabel;
