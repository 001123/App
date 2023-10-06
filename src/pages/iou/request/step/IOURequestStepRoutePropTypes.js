import PropTypes from 'prop-types';

export default PropTypes.shape({
    /** Route specific parameters used on this screen via route :iouType/new/category/:reportID? */
    params: PropTypes.shape({
        /** The type of IOU report, i.e. bill, request, send */
        iouType: PropTypes.string.isRequired,

        /** The ID of the transaction being configured */
        transactionID: PropTypes.string.isRequired,

        /** The current step the user is on */
        step: PropTypes.string,

        /** The report ID of the IOU */
        reportID: PropTypes.string.isRequired,

        /** Index of the waypoint being edited */
        pageIndex: PropTypes.string,

        /** A path to go to when the user presses the back button */
        backTo: PropTypes.string,
    }),
});
