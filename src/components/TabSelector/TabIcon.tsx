import React from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import Icon, {SrcProps} from '@components/Icon';
import useTheme from '@hooks/useTheme';

type TabIconProps = {
    /** Icon to display on tab */
    icon?: (props: SrcProps) => React.ReactNode;

    /** Animated opacity value while the label is inactive state */
    inactiveOpacity?: number | Animated.AnimatedInterpolation<number>;

    /** Animated opacity value while the label is in active state */
    activeOpacity?: number | Animated.AnimatedInterpolation<number>;
};

function TabIcon({icon, activeOpacity = 0, inactiveOpacity = 1}: TabIconProps) {
    const theme = useTheme();
    return (
        <View>
            {icon && (
                <>
                    <Animated.View style={{opacity: inactiveOpacity}}>
                        <Icon
                            src={icon}
                            fill={theme.icon}
                        />
                    </Animated.View>
                    <Animated.View style={[StyleSheet.absoluteFill, {opacity: activeOpacity}]}>
                        <Icon
                            src={icon}
                            fill={theme.iconMenu}
                        />
                    </Animated.View>
                </>
            )}
        </View>
    );
}

TabIcon.displayName = 'TabIcon';

export default TabIcon;
