import React from 'react';
import {View} from 'react-native';
import Badge from '@components/Badge';
import Button from '@components/Button';
import * as Expensicons from '@components/Icon/Expensicons';
import useLocalize from '@hooks/useLocalize';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as SearchUtils from '@libs/SearchUtils';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import type {SearchTransactionAction} from '@src/types/onyx/SearchResults';

const actionTranslationsMap: Record<SearchTransactionAction, TranslationPaths> = {
    view: 'common.view',
    review: 'common.review',
    done: 'common.done',
    paid: 'iou.settledExpensify',
    hold: 'iou.hold',
    unhold: 'iou.unhold',
};

type ActionCellProps = {
    action?: SearchTransactionAction;
    transactionID: string;
    searchHash: number;
    isLargeScreenWidth?: boolean;
    goToItem: () => void;
};

function ActionCell({action = CONST.SEARCH.ACTION_TYPES.VIEW, transactionID, searchHash, isLargeScreenWidth = true, goToItem}: ActionCellProps) {
    const {translate} = useLocalize();
    const theme = useTheme();
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();

    const text = translate(actionTranslationsMap[action]);

    if (action === CONST.SEARCH.ACTION_TYPES.PAID || action === CONST.SEARCH.ACTION_TYPES.DONE) {
        return (
            <View style={[StyleUtils.getHeight(variables.h28), styles.justifyContentCenter]}>
                <Badge
                    text={text}
                    icon={Expensicons.Checkmark}
                    badgeStyles={[
                        styles.ml0,
                        styles.ph2,
                        styles.gap1,
                        isLargeScreenWidth ? styles.alignSelfCenter : styles.alignSelfEnd,
                        StyleUtils.getBorderColorStyle(theme.border),
                        StyleUtils.getHeight(variables.h20),
                        StyleUtils.getMinimumHeight(variables.h20),
                    ]}
                    textStyles={StyleUtils.getFontSizeStyle(variables.fontSizeExtraSmall)}
                    iconStyles={styles.mr0}
                    success
                />
            </View>
        );
    }

    if (action === CONST.SEARCH.ACTION_TYPES.VIEW || action === CONST.SEARCH.ACTION_TYPES.REVIEW) {
        return (
            <Button
                text={text}
                onPress={goToItem}
                small
                pressOnEnter
                style={[styles.w100]}
            />
        );
    }

    const onAction = SearchUtils.getTransactionAction(action);

    return (
        <Button
            text={text}
            onPress={() => {
                if (!onAction) {
                    return;
                }

                onAction(searchHash, transactionID);
            }}
            small
            pressOnEnter
            style={[styles.w100]}
        />
    );
}

ActionCell.displayName = 'ActionCell';

export default ActionCell;
