import type {ReactNode} from 'react';
import React, {useMemo} from 'react';
import type {StyleProp, TextStyle, ViewStyle} from 'react-native';
import {View} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';
import EnvironmentBadge from './EnvironmentBadge';
import Text from './Text';

type HeaderProps = {
    /** Title of the Header */
    title?: ReactNode;

    /** Subtitle of the header */
    subtitle?: ReactNode;

    /** Should we show the environment badge (dev/stg)?  */
    shouldShowEnvironmentBadge?: boolean;

    /** Additional text styles */
    textStyles?: StyleProp<TextStyle>;

    /** Additional header container styles */
    containerStyles?: StyleProp<ViewStyle>;

    /** Whether to show the subtitle on the top or bottom */
    subtitleOnTop?: boolean;
};

function Header({title = '', subtitle = '', textStyles = [], containerStyles = [], shouldShowEnvironmentBadge = false, subtitleOnTop = true}: HeaderProps) {
    const styles = useThemeStyles();
    const renderedSubtitle = useMemo(
        () => (
            <>
                {/* If there's no subtitle then display a fragment to avoid an empty space which moves the main title */}
                {typeof subtitle === 'string'
                    ? Boolean(subtitle) && (
                          <Text
                              style={[styles.mutedTextLabel, styles.pre]}
                              numberOfLines={1}
                          >
                              {subtitle}
                          </Text>
                      )
                    : subtitle}
            </>
        ),
        [subtitle, styles],
    );
    return (
        <View style={[styles.flex1, styles.flexRow, containerStyles]}>
            <View style={styles.mw100}>
                {subtitleOnTop && renderedSubtitle}
                {typeof title === 'string'
                    ? Boolean(title) && (
                          <Text
                              numberOfLines={2}
                              style={[styles.headerText, styles.textLarge, textStyles]}
                          >
                              {title}
                          </Text>
                      )
                    : title}
                {!subtitleOnTop && renderedSubtitle}
            </View>
            {shouldShowEnvironmentBadge && <EnvironmentBadge />}
        </View>
    );
}

Header.displayName = 'Header';

export default Header;

export type {HeaderProps};
