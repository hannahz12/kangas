'use client';

import { useContext, useCallback, useState, useEffect } from "react";
import { ViewContext } from "../contexts/ViewContext";
import classNames from 'classnames/bind';
import styles from './Cell.module.scss';
import { Resizable } from 're-resizable';
import { getDefaultCellSize } from "./base";

const cx = classNames.bind(styles);


/*
The startResizing/stopResizing/initWidth dynamic is potentially a bit confusing.
The gist is that we need to update the width of every cell in a column as we resize
a given cell. Because of the way react-resizable works under the hood, simply updating
the cell widths via onResize will often lead to the widths of different cells falling out of sync.
Using the startResizing/stopResizing/initWidth dynamic, we can force all widths to stay in sync.
*/

const CellClient = ({ columnName, type, isHeader, children, grouped }) => {
    const { columns, updateWidth } = useContext(ViewContext);
    const [isResizing, setIsResizing] = useState(false);
    const [initWidth, setInitWidth] = useState(getDefaultCellSize(type, grouped));

    // CHECKME: is this correct for switching between group/non-grouped?
    useEffect(() => {
        const width = getDefaultCellSize(type, grouped);
        if (width != initWidth) {
            setInitWidth(width);
            updateWidth({
                [columnName]: {
                    width: width
                }
            });
        }
    }, [type, grouped, updateWidth]);

    const resize = useCallback((d) => {
        updateWidth({
            [columnName]: {
                width: initWidth + (d?.width ?? 0)
            }
        });
    }, [columnName, initWidth]);

    const startResizing = useCallback(() => setIsResizing(true), []);
    const stopResizing = useCallback(() => setIsResizing(false), []);

    useEffect(() => {
        if (!isResizing && (columns?.[columnName]?.width !== initWidth)) {
            setInitWidth(columns?.[columnName]?.width ?? initWidth);
        }
    }, [isResizing, columns?.[columnName]?.width, initWidth]);

    const headerResizeStyle = {
	'width': '1px',
	'backgroundColor': 'silver',
	'border': '2px ridge silver',
	'borderRadius': '2px',
	'right': '0px',
	'height': '100%',
	'top': '-2px',
    };


    return (
        <Resizable
            className={cx('cell', { header: isHeader, group: grouped})}
            handleStyles={isHeader ? {'right': headerResizeStyle} : {'right': {'backgroundColor': '#fafafa'}}}
            size={{
                width: columns?.[columnName]?.width ?? initWidth,
                height: 0
            }}
            enable={{
                right: true
            }}
            onResizeStart={startResizing}
            onResize={(e, direction, ref, d) => {
                resize(d)
            }}
            onResizeStop={stopResizing}
        >
            { children }
        </Resizable>
    )
}

export default CellClient;
