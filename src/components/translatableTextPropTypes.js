import PropTypes from 'prop-types';

/**
 * Traslatable text with phrase key and/or variables
 *
 * E.g. ['common.error.characterLimitExceedCounter', {length: 5, limit: 20}]
 */
export default PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object]))]);
