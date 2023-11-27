/* eslint-disable no-underscore-dangle */
import {ResizeMode, Video} from 'expo-av';
import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import {usePlaybackContext} from '@components/VideoPlayerContexts/PlaybackContext';
import useWindowDimensions from '@hooks/useWindowDimensions';
import addEncryptedAuthTokenToURL from '@libs/addEncryptedAuthTokenToURL';
import stylePropTypes from '@styles/stylePropTypes';
import styles from '@styles/styles';
import VideoPlayerControls from './VideoPlayerControls';

const propTypes = {
    url: PropTypes.string.isRequired,

    shouldPlay: PropTypes.bool,

    onVideoLoaded: PropTypes.func,

    resizeMode: PropTypes.string,

    isLooping: PropTypes.bool,

    style: stylePropTypes,

    videoStyle: stylePropTypes,

    shouldUseSharedVideoElement: PropTypes.bool,

    shouldUseSmallVideoControls: PropTypes.bool,

    isHovered: PropTypes.bool,
};

const defaultProps = {
    shouldPlay: false,
    onVideoLoaded: () => {},
    resizeMode: ResizeMode.CONTAIN,
    isLooping: false,
    style: [styles.w100, styles.h100],
    videoStyle: [styles.w100, styles.h100],
    shouldUseSharedVideoElement: false,
    shouldUseSmallVideoControls: false,
    isHovered: true,
};

function VideoPlayer({url, resizeMode, shouldPlay, onVideoLoaded, isLooping, style, videoStyle, shouldUseSharedVideoElement, shouldUseSmallVideoControls, isHovered}) {
    const {isSmallScreenWidth} = useWindowDimensions();
    const {currentlyPlayingURL, updateSharedElements, sharedElement, originalParent, shareVideoPlayerElements, currentVideoPlayerRef} = usePlaybackContext();
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const videoPlayerRef = useRef(null);
    const videoPlayerElementParentRef = useRef(null);
    const videoPlayerElementRef = useRef(null);
    const sharedVideoPlayerParentRef = useRef(null);
    const sourceURLWithAuth = addEncryptedAuthTokenToURL(url);

    const onPlaybackStatusUpdate = useCallback((e) => {
        const isVideoPlaying = e.isPlaying || false;
        setIsPlaying(isVideoPlaying);
        setIsLoading(Number.isNaN(e.durationMillis)); // when video is ready to display duration is not NaN
        setDuration(e.durationMillis || 0);
        setPosition(e.positionMillis || 0);
    }, []);

    const bindFunctions = useCallback(() => {
        currentVideoPlayerRef.current._onPlaybackStatusUpdate = onPlaybackStatusUpdate;
        // update states after binding
        currentVideoPlayerRef.current.getStatusAsync().then((status) => {
            onPlaybackStatusUpdate(status);
        });
    }, [currentVideoPlayerRef, onPlaybackStatusUpdate]);

    // update shared video elements
    useEffect(() => {
        if (shouldUseSharedVideoElement || url !== currentlyPlayingURL) {
            return;
        }
        shareVideoPlayerElements(videoPlayerRef.current, videoPlayerElementParentRef.current, videoPlayerElementRef.current);
    }, [currentlyPlayingURL, shouldUseSharedVideoElement, shareVideoPlayerElements, updateSharedElements, url]);

    // append shared video element to new parent (used for example in attachment modal)
    useEffect(() => {
        if (url !== currentlyPlayingURL || !sharedElement || !shouldUseSharedVideoElement) {
            return;
        }

        const newParentRef = sharedVideoPlayerParentRef.current;
        videoPlayerRef.current = currentVideoPlayerRef.current;
        if (currentlyPlayingURL === url) {
            newParentRef.appendChild(sharedElement);
            bindFunctions();
        }
        return () => {
            if (!originalParent && !newParentRef.childNodes[0]) {
                return;
            }
            originalParent.appendChild(sharedElement);
        };
    }, [bindFunctions, currentVideoPlayerRef, currentlyPlayingURL, isSmallScreenWidth, originalParent, sharedElement, shouldUseSharedVideoElement, url]);

    return (
        <View style={[styles.w100, styles.h100]}>
            {shouldUseSharedVideoElement ? (
                <>
                    <View
                        ref={sharedVideoPlayerParentRef}
                        style={[styles.flex1]}
                    />
                    {/* We are adding transaprent absolute View between appended video component and conttrol buttons to enable
                      catching onMosue events from Attachment Carousel. Due to late appending React doesn't handle
                       element's events properly.  */}
                    <View style={[styles.w100, styles.h100, styles.pAbsolute]} />
                </>
            ) : (
                <View
                    style={styles.flex1}
                    ref={(el) => {
                        if (!el) {
                            return;
                        }
                        videoPlayerElementParentRef.current = el;
                        if (el.childNodes && el.childNodes[0]) {
                            videoPlayerElementRef.current = el.childNodes[0];
                        }
                    }}
                >
                    <View style={styles.flex1}>
                        <Video
                            ref={videoPlayerRef}
                            style={style}
                            videoStyle={videoStyle}
                            source={{
                                uri: sourceURLWithAuth, // testing video url: 'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4',
                            }}
                            shouldPlay={shouldPlay}
                            useNativeControls={false}
                            resizeMode={resizeMode}
                            isLooping={isLooping}
                            onReadyForDisplay={onVideoLoaded}
                            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                        />
                    </View>
                </View>
            )}

            {isLoading && <FullScreenLoadingIndicator style={[styles.opacity1, styles.bgTransparent]} />}

            {!isLoading && isHovered && (
                <VideoPlayerControls
                    duration={duration}
                    position={position}
                    url={url}
                    videoPlayerRef={videoPlayerRef}
                    isPlaying={isPlaying}
                    small={shouldUseSmallVideoControls}
                />
            )}
        </View>
    );
}

VideoPlayer.propTypes = propTypes;
VideoPlayer.defaultProps = defaultProps;
VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
