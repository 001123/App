import React, {useState, useRef, useMemo, useEffect} from 'react';
import {View} from 'react-native';
import PropTypes from 'prop-types';
import VideoPlayer from '../VideoPlayer';
import styles from '../../styles/styles';
import VideoPlayerThumbnail from './VideoPlayerThumbnail';
import useWindowDimensions from '../../hooks/useWindowDimensions';
import {usePlaybackContext} from '../PlaybackContext';
import IconButton from '../VideoPlayer/IconButton';
import * as Expensicons from '../Icon/Expensicons';

const propTypes = {
    videoUrl: PropTypes.string.isRequired,

    // eslint-disable-next-line react/forbid-prop-types
    videoDimensions: PropTypes.object,

    thumbnailUrl: PropTypes.stridg,

    fileName: PropTypes.string.isRequired,

    showModal: PropTypes.func.isRequired,
};

const defaultProps = {
    videoDimensions: {width: 1900, height: 1400},
    thumbnailUrl: 'https://d33v4339jhl8k0.cloudfront.net/docs/assets/591c8a010428634b4a33375c/images/5ab4866b2c7d3a56d8873f4c/file-MrylO8jADD.png',
};

function VideoPlayerPreview({videoUrl, thumbnailUrl, fileName, videoDimensions, showModal}) {
    const {currentlyPlayingURL, updateCurrentlyPlayingURL, updateSharedElements} = usePlaybackContext();
    const {isSmallScreenWidth} = useWindowDimensions();
    const [isThumbnail, setIsThumbnail] = useState(true);
    const [measuredDimenstions, setMeasuredDimenstions] = useState(null);
    const videoPlayerRef = useRef(null);
    const videoPlayerParentRef = useRef(null);

    const videoStyles = useMemo(() => {
        const {width, height} = measuredDimenstions || videoDimensions;
        const aspectRatio = width / height;
        if (width > height) return {width: 350, aspectRatio};
        return {height: 350, aspectRatio};
    }, [videoDimensions, measuredDimenstions]);

    const onVideoLoaded = (e) => {
        setMeasuredDimenstions({width: e.srcElement.videoWidth, height: e.srcElement.videoHeight});
    };

    const handleOnPress = () => {
        updateCurrentlyPlayingURL(videoUrl);
        if (isSmallScreenWidth) {
            showModal();
        }
    };

    useEffect(() => {
        if (videoUrl !== currentlyPlayingURL) return;
        setIsThumbnail(false);
    }, [currentlyPlayingURL, videoUrl]);

    useEffect(() => {
        if (isThumbnail || videoUrl !== currentlyPlayingURL) return;
        updateSharedElements(videoPlayerParentRef.current, videoPlayerRef.current);
    }, [currentlyPlayingURL, isThumbnail, updateSharedElements, videoUrl]);

    return (
        <View style={[styles.overflowHidden, styles.webViewStyles.tagStyles.img, videoStyles]}>
            {isSmallScreenWidth || isThumbnail ? (
                <VideoPlayerThumbnail
                    thumbnailUrl={thumbnailUrl}
                    onPress={handleOnPress}
                    accessibilityLabel={fileName}
                />
            ) : (
                <View
                    ref={(el) => {
                        if (!el) return;
                        videoPlayerParentRef.current = el;
                        if (el.childNodes[0]) videoPlayerRef.current = el.childNodes[0];
                    }}
                    style={styles.flex1}
                >
                    <View style={styles.flex1}>
                        <IconButton
                            src={Expensicons.Expand}
                            fill="white"
                            style={{position: 'absolute', top: 10, right: 10, backgroundColor: '#061B09CC', borderRadius: 5}}
                            accessibilityLabel="open in modal"
                            onPress={showModal}
                        />
                        <VideoPlayer
                            url={videoUrl}
                            videoPlayerStyles={{borderRadius: 10}}
                            shouldPlay={false}
                            onOpenInModalButtonPress={showModal}
                            onVideoLoaded={onVideoLoaded}
                        />
                    </View>
                </View>
            )}
        </View>
    );
}

VideoPlayerPreview.propTypes = propTypes;
VideoPlayerPreview.defaultProps = defaultProps;
VideoPlayerPreview.displayName = 'VideoPlayerPreview';

export default VideoPlayerPreview;
