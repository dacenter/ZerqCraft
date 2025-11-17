// Particle System for visual effects
class ParticleSystem {
    constructor() {
        this.container = document.getElementById('particles');
    }

    createExplosion(x, y, color = '#ffd700', count = 20) {
        for (let i = 0; i < count; i++) {
            this.createParticle(x, y, color);
        }
    }

    createParticle(x, y, color) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        const size = Math.random() * 20 + 10;
        const tx = (Math.random() - 0.5) * 300;
        const ty = (Math.random() - 0.5) * 300;

        particle.style.cssText = `
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            --tx: ${tx}px;
            --ty: ${ty}px;
        `;

        this.container.appendChild(particle);

        setTimeout(() => particle.remove(), 1000);
    }

    createTrail(x, y, color = '#4ecdc4') {
        const trail = document.createElement('div');
        trail.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: 10px;
            height: 10px;
            background: ${color};
            border-radius: 50%;
            pointer-events: none;
            animation: trailFade 0.5s ease-out forwards;
        `;

        this.container.appendChild(trail);
        setTimeout(() => trail.remove(), 500);
    }

    createComboText(x, y, text) {
        const comboElement = document.createElement('div');
        comboElement.className = 'combo-text';
        comboElement.textContent = text;
        comboElement.style.left = x + 'px';
        comboElement.style.top = y + 'px';

        this.container.appendChild(comboElement);
        setTimeout(() => comboElement.remove(), 1000);
    }
}

// Add trail fade animation
if (!document.querySelector('#trail-animation')) {
    const style = document.createElement('style');
    style.id = 'trail-animation';
    style.textContent = `
        @keyframes trailFade {
            from { opacity: 0.8; transform: scale(1); }
            to { opacity: 0; transform: scale(0.3); }
        }
    `;
    document.head.appendChild(style);
}
