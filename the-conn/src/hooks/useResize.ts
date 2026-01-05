import { useState, useEffect, useRef } from 'react';

export const useResize = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Set initial size
        setSize({
            width: element.clientWidth,
            height: element.clientHeight
        });

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                // Use contentRect for precise dimensions inside padding/borders
                setSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return { ref, width: size.width, height: size.height };
};
