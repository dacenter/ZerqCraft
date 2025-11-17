// Multi-touch Handler for all games
class TouchHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.touches = new Map();
        this.callbacks = {
            onTouchStart: [],
            onTouchMove: [],
            onTouchEnd: []
        };

        this.init();
    }

    init() {
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

        // Mouse events (for testing)
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }

    handleTouchStart(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const touchData = {
                id: touch.identifier,
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top,
                startX: touch.clientX - rect.left,
                startY: touch.clientY - rect.top,
                startTime: Date.now()
            };

            this.touches.set(touch.identifier, touchData);

            this.callbacks.onTouchStart.forEach(cb => cb(touchData));
        }
    }

    handleTouchMove(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const touchData = this.touches.get(touch.identifier);

            if (touchData) {
                touchData.x = touch.clientX - rect.left;
                touchData.y = touch.clientY - rect.top;

                this.callbacks.onTouchMove.forEach(cb => cb(touchData));
            }
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const touchData = this.touches.get(touch.identifier);

            if (touchData) {
                touchData.endTime = Date.now();
                touchData.duration = touchData.endTime - touchData.startTime;

                this.callbacks.onTouchEnd.forEach(cb => cb(touchData));
                this.touches.delete(touch.identifier);
            }
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const touchData = {
            id: 'mouse',
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            startX: e.clientX - rect.left,
            startY: e.clientY - rect.top,
            startTime: Date.now()
        };

        this.touches.set('mouse', touchData);
        this.callbacks.onTouchStart.forEach(cb => cb(touchData));
    }

    handleMouseMove(e) {
        const touchData = this.touches.get('mouse');
        if (touchData) {
            const rect = this.canvas.getBoundingClientRect();
            touchData.x = e.clientX - rect.left;
            touchData.y = e.clientY - rect.top;

            this.callbacks.onTouchMove.forEach(cb => cb(touchData));
        }
    }

    handleMouseUp(e) {
        const touchData = this.touches.get('mouse');
        if (touchData) {
            touchData.endTime = Date.now();
            touchData.duration = touchData.endTime - touchData.startTime;

            this.callbacks.onTouchEnd.forEach(cb => cb(touchData));
            this.touches.delete('mouse');
        }
    }

    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }

    getActiveTouches() {
        return Array.from(this.touches.values());
    }

    getTouchCount() {
        return this.touches.size;
    }

    destroy() {
        this.touches.clear();
        this.callbacks.onTouchStart = [];
        this.callbacks.onTouchMove = [];
        this.callbacks.onTouchEnd = [];
    }
}
