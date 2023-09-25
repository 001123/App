import React from 'react';
import _ from 'underscore';
import PropTypes from 'prop-types';
import {View} from 'react-native';
import Icon from './Icon';
import * as Expensicons from './Icon/Expensicons';
import Text from './Text';
import themeColors from '../styles/themes/default';
import styles from '../styles/styles';
import stylePropTypes from '../styles/stylePropTypes';
import * as Localize from '../libs/Localize';

const propTypes = {
    /** Error or hint text. Ignored when children is not empty */
    message: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object]))]),

    /** Children to render next to dot indicator */
    children: PropTypes.node,

    /** Indicates whether to show error or hint */
    isError: PropTypes.bool,

    /** Container style props */
    style: stylePropTypes,

    /** Container text style props */
    containerMessageStyle: stylePropTypes,

    /** Whether to show dot indicator */
    shouldShowRedDotIndicator: PropTypes.bool,
};

const defaultProps = {
    message: '',
    children: null,
    isError: true,
    shouldShowRedDotIndicator: true,
    style: [],
    containerMessageStyle: {},
};

function FormHelpMessage(props) {
    if (_.isEmpty(props.message) && _.isEmpty(props.children)) {
        return null;
    }

    const translatedMessage = Localize.translateIfPhraseKey(props.message);
    return (
        <View style={[styles.flexRow, styles.alignItemsCenter, styles.mt2, styles.mb1, ...props.style, styles.justifyContentCenter]}>
            {props.isError && props.shouldShowRedDotIndicator && (
                <Icon
                    src={Expensicons.DotIndicator}
                    fill={themeColors.danger}
                />
            )}
            <View style={[styles.flex1, props.isError && props.shouldShowRedDotIndicator ? styles.ml2 : {}, props.containerMessageStyle]}>
                {props.children || <Text style={[props.isError ? styles.formError : styles.formHelp, styles.mb0]}>{translatedMessage}</Text>}
            </View>
        </View>
    );
}

FormHelpMessage.propTypes = propTypes;
FormHelpMessage.defaultProps = defaultProps;
FormHelpMessage.displayName = 'FormHelpMessage';

export default FormHelpMessage;
