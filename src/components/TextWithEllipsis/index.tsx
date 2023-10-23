import React from 'react';
import {StyleProp, TextStyle, View, ViewStyle} from 'react-native';
import Text from '../Text';
import styles from '../../styles/styles';

type TextWithEllipsisProps = {
    /** Leading text before the ellipsis */
    leadingText: string;

    /** Text after the ellipsis */
    trailingText: string;

    /** Styles for leading and trailing text */
    textStyle: TextStyle;

    /** Styles for leading text View */
    leadingTextParentStyle: StyleProp<ViewStyle>;

    /** Styles for parent View */
    wrapperStyle: StyleProp<ViewStyle>;
}

function TextWithEllipsis({leadingText, trailingText, textStyle = {}, leadingTextParentStyle = {}, wrapperStyle = {}}: TextWithEllipsisProps) {
    return (
        <View style={[styles.flexRow, wrapperStyle]}>
            <View style={[styles.flexShrink1, leadingTextParentStyle]}>
                <Text style={textStyle}>
                    {leadingText}
                </Text>
            </View>
            <View style={styles.flexShrink0}>
                <Text style={textStyle}>{trailingText}</Text>
            </View>
        </View>
    );
}

TextWithEllipsis.displayName = 'TextWithEllipsis';

export default TextWithEllipsis;
