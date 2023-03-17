'use client';

import { useCallback, useMemo, useEffect, useRef, useState, useContext, useLayoutEffect } from 'react';
import { CanvasContext } from '../../../contexts/CanvasContext';
import useLabels from '../../../../lib/hooks/useLabels';
import { getColor, getContrastingColor, hexToRgb } from '../../../../lib/generateChartColor';
import styles from './ImageCanvas.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);


const drawMarker = function(ctx, marker, x, y) {
    if (marker.shape === "circle") {
        drawCircle(ctx, marker, x, y);
    } else if (marker.shape === "raindrop") {
        drawRaindrop(ctx, marker, x, y);
    } else {
        console.log(`unknown shape ${marker.shape}`);
    }
};

const drawCircle = function(ctx, marker, x, y) {
    ctx.fillStyle = marker.color;
    ctx.lineWidth = marker.borderWidth;
    ctx.beginPath();
    ctx.arc(x, y, marker.size/2, 0, Math.PI * 2);
    ctx.fill();
};

const drawRaindrop = function(ctx, marker, x, y) {
    marker.width = marker.size;
    marker.height = marker.size * 1.5;
    marker.contrastingColor = getContrastingColor(marker.color);

    // Move the drawing routine to make x,y be centered
    // on point:
    y -= marker.height;
    x -= marker.width / 2;

    ctx.lineWidth = 1.2;
    rainDrop(ctx, x + 1, y + 1, marker.width, marker.height, marker.contrastingColor, false);
    rainDrop(ctx, x, y, marker.width, marker.height, marker.color, false);

    // Highlight area
    ctx.beginPath();
    const highlight = {
        color: marker.contrastingColor,
        width: marker.width / 4,
        x: x + marker.width / 2,
        y: y + (marker.height / 3)
    };
    ctx.arc(highlight.x, highlight.y, highlight.width / 2, Math.PI * 2, 0, false);
    ctx.fillStyle = highlight.color;
    ctx.fill();
};


const rainDrop = function(ctx, x, y, width, height, fill, stroke) {
    // Center points
    const center = {
	x: x + width/2,
        y: y + height/2
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Top arc
    ctx.beginPath();
    ctx.arc(center.x, y + height/3, width/2, Math.PI, 0, false);

    // Right bend
    ctx.bezierCurveTo(
        x + width,
        y + (height/3) + height/4,
        center.x + width/3,
        center.y,
        center.x,
        y + height
    );

    // Left bend
    ctx.moveTo(x, y + height/3);
    ctx.bezierCurveTo(
        x,
        y + (height/3) + height/4,
        center.x - width/3,
        center.y,
        center.x,
        y + height
    );

    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }

    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
};


const ImageCanvasOutputClient = ({ assetId, dgid, timestamp, imageSrc }) => {
    const containerRef = useRef();
    const labelCanvas = useRef();
    const img = useRef();
    const [loaded, setLoaded] = useState(false);

    const {
        annotations,
        score,
        labels,
        hiddenLabels,
    } = useLabels({ assetId, timestamp, dgid });

    const [dimensions, setDimensions] = useState({ height: 400, width: 400 });
    const { settings, isGroup } = useContext(CanvasContext);
    const zoom = useMemo(() => {
        if (isGroup) return 1;
        else return Math.max(settings?.zoom ?? 1, 1);
    }, [settings?.zoom]);
    const smooth = useMemo(() => settings?.smooth ?? true, [settings?.smooth]);
    const gray = useMemo(() => settings?.gray ?? false, [settings?.gray]);


    const isVertical = useMemo(() => dimensions?.height > dimensions?.width, [dimensions]);
    const imageScale = useMemo(() => {
        if (!loaded) return 1;

        if (isVertical) {
            return ( 400 / dimensions?.height ) * ( zoom ?? 1 );
        }
        else {
            return ( 400 / dimensions?.width ) * ( zoom ?? 1 );
        }
    }, [settings?.zoom, isVertical, loaded, zoom, isGroup, dimensions]);


    const imgDims = useMemo(() => {
        return {
            height: Math.round( dimensions.height * imageScale ) || 400,
            width: Math.round( dimensions.width * imageScale ) || 400
        };
    }, [dimensions, imageScale]);


    const drawLabels = useCallback(() => {
        if (labels) {
            const ctx = labelCanvas.current.getContext("2d");
            ctx.clearRect(0, 0, imgDims.width, imgDims.height);
            // Display any masks first:
            for (let reg = 0; reg < labels.length; reg++) {
                if (labels[reg]?.mask) {
                    // FIXME: look at first labels value {32: "person", ...}
                    processMask(ctx, labels[reg].mask, imgDims, hiddenLabels);
                }
            }
            // Next, draw all other annotations:
            for (let reg = 0; reg < labels.length; reg++) {
                if (labels[reg]?.score) {
                    if (annotations[reg]?.score < score) continue;
                }
                if (!!labels[reg]?.points) {
                    const points = labels[reg].points;
                    if (!hiddenLabels?.[labels[reg].label]) {
                        for (let r = 0; r < points.length; r++) {
                            const region = points[r];
                            ctx.fillStyle = getColor(
                                labels[reg].label
                            );
                            ctx.beginPath();
                            ctx.moveTo(
                                region[0] * imageScale,
                                region[1] * imageScale
                            );
                            for (let i = 2; i < region.length; i += 2) {
                                ctx.lineTo(
                                    region[i] * imageScale,
                                    region[i + 1] * imageScale
                                );
                            }
                            ctx.closePath();
                            ctx.fill();
                        }
                    }
                } else if (!!labels[reg]?.boxes) {
                    const boxes = labels[reg].boxes;
                    if (!hiddenLabels?.[labels[reg]?.label]) {
                        for (let r = 0; r < boxes.length; r++) {
                            const [x1, y1, x2, y2] = boxes[r];
                            ctx.strokeStyle = getColor(
                                labels[reg].label
                            );
                            ctx.lineWidth = 3;
                            ctx.beginPath();
                            ctx.moveTo(x1 * imageScale, y1 * imageScale);
                            ctx.lineTo((x1 + x2) * imageScale, y1 * imageScale);
                            ctx.lineTo((x1 + x2) * imageScale, (y1 + y2) * imageScale);
                            ctx.lineTo(x1 * imageScale, (y1 + y2) * imageScale);
                            ctx.closePath();
                            ctx.stroke();
                        }
                    }
                } else if (labels[reg]?.lines) {
                    const lines = labels[reg].lines;
                    if (!hiddenLabels?.[labels[reg]?.label]) {
                        for (let r = 0; r < lines.length; r++) {
                            const [x1, y1, x2, y2] = lines[r];
                            ctx.strokeStyle = getColor(
                                labels[reg].label
                            );
                            ctx.lineWidth = 3;
                            ctx.beginPath();
                            ctx.moveTo(x1 * imageScale, y1 * imageScale);
                            ctx.lineTo(x2 * imageScale, y2 * imageScale);
                            ctx.stroke();
                        }
                    }
                } else if (labels[reg]?.markers) {
                    const markers = labels[reg].markers;
		    let marker = null;
                    if (!hiddenLabels?.[labels[reg]?.label]) {
                        for (let r = 0; r < markers.length; r++) {
                            const marker = markers[r];
			    marker.color = getColor(
				labels[reg].label
			    );
			    drawMarker(ctx, marker, marker.x * imageScale, marker.y * imageScale);
			}
                    }
                } else if (labels[reg]?.mask) {
                    // skip here; already drawn
                } else {
		    console.log(`unknown annotation type: ${labels[reg]}`);
		}
            }
        }
    }, [imageScale, score, hiddenLabels, labels, imgDims]);


    const processMask = function(ctx, mask, imageDims, hiddenLabels) {
        // ctx is context
        // mask is from user; {"array": array, "width": width, "height": height, "map": label_map},
        // imageDims is {x: , y:} current size
        // hiddenLabels is hiddenLabels.person object of hidden items

        //const tcanvas = new OffscreenCanvas(mask.width, mask.height);
        //const tctx = tcanvas.getContext("2d");
        //const mask = makeMask(mask.width, mask.height, 128); // alpha
        //tctx.putImageData(mask, 0, 0);
        //tctx.scale(imgDims.width/mask.width, imgDims.height/mask.height);
        //ctx.drawImage(tcanvas, 0, 0);

        const image = makeMaskImage(mask.array, mask.map, hiddenLabels, mask.width, mask.height, 128);
        ctx.putImageData(image, 0, 0);
    };

    const makeMaskImage = function(data, map, hiddenLabels, width, height, alpha) {
        const buffer = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let pos = (y * width + x) * 4; // position in buffer based on x and y
                const classCode = data[height][width];
                const label = map[classCode];
                if (!hiddenLabels[label]) {
                    const rgb = hexToRgb(getColor(label));
                    buffer[pos  ] = rgb[0];
                    buffer[pos+1] = rgb[1];
                    buffer[pos+2] = rgb[2];
                    buffer[pos+3] = alpha;
                }
            }
        }
        return new ImageData(buffer, width, height); // settings can be colorSpace name
    };

    const onLoad = useCallback((e) => {
        setDimensions({
            width: e.target.naturalWidth,
            height: e.target.naturalHeight
        });
        setLoaded(true);
    }, []);


    useEffect(() => {
        if (loaded) {
            labelCanvas.current.width = imgDims.width;
            labelCanvas.current.height = imgDims.height;
            containerRef.current.style.width = `${imgDims.width}px`;
            containerRef.current.style.height = `${imgDims.height}px`;
        }
    }, [imgDims]);

    useEffect(() => {
        if (loaded) {
            drawLabels();
        }
    }, [loaded, drawLabels]);

    return (
        <div className={cx('canvas-container', { vertical: isVertical, horizontal: !isVertical, grouped: isGroup })} ref={containerRef}>
            <canvas
                className={cx(['output', 'canvas'], { vertical: isVertical, horizontal: !isVertical, single: !isGroup })} ref={labelCanvas}
            />
            <img
                className={cx(
                    ['output', 'image'],
                    {
                        vertical: isVertical,
                        horizontal: !isVertical,
                        pixelated: !smooth,
                        grayscale: gray,
                        single: !isGroup
                    }
                )}
                ref={img}
                src={imageSrc}
                loading="lazy"
                height={imgDims?.height}
                width={imgDims?.width}
                onLoad={onLoad}
            />
        </div>
    )

}

export default ImageCanvasOutputClient;


// for dev, add this to <canvas> title={`asset: ${assetId} imscale: ${imageScale} cd: ${labelCanvas.current?.height} x ${labelCanvas.current?.width} id: ${img.current?.height} x ${img.current?.width}`}
