document.addEventListener('DOMContentLoaded', () => {
    gsap.registerPlugin(ScrollTrigger);

    // --- Theme Switcher ---
    const themeSwitcher = document.getElementById('theme-switcher');
    const body = document.body;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.classList.add(savedTheme);
    }
    themeSwitcher.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        if (body.classList.contains('dark-theme')) {
            localStorage.setItem('theme', 'dark-theme');
        } else {
            localStorage.removeItem('theme');
        }
    });

    // --- Chapter 1: Direct Intro Animation ---
    gsap.from("#chapter-1 > *", {
        opacity: 0, y: 20, duration: 1, stagger: 0.3, ease: "power3.out"
    });

    // --- Chapter 2: Continuous Scroll Transition ---
    const introTimeline = gsap.timeline({
        scrollTrigger: {
            trigger: "#chapter-1",
            start: "top top",
            end: "+=100%",
            scrub: 1,
            pin: true,
            anticipatePin: 1
        }
    });
    // Animate out the intro content
    introTimeline.fromTo("#chapter-1 > *", 
        { opacity: 1, y: 0 }, 
        { opacity: 0, y: -30, stagger: 0.2, ease: "power2.in" }
    );
    gsap.from("#chapter-2 .philosophy-content > *", {
        scrollTrigger: {
            trigger: "#chapter-2",
            start: "top 80%",
            end: "top 40%",
            scrub: 1,
        },
        opacity: 0, y: 50, stagger: 0.3, ease: "power3.out"
    });

    // --- Chapter 3 & 4: Constellation and Zoom ---
    const canvas = document.getElementById('skill-constellation');
    const ctx = canvas.getContext('2d');
    let nodes = [];
    const skills = [
        'Python', 'C++', 'Rust', 'Haskell', 'Go', 'MATLAB', 'Redis', 'Kafka', 'Spark', 'Microservices', 'Kubernetes', 'Docker', 'gRPC', 'NumPy', 'PyTorch', 'SQL', 'Linux', 'CI/CD'
    ];
    const camera = { x: 0, y: 0, scale: 1 };
    let animationFrameId = null;

    function createNodes() {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.3;
        nodes = skills.map((skill, i) => {
            const angle = (i / skills.length) * Math.PI * 2;
            return {
                x: centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 50,
                y: centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 50,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                text: skill,
                radius: 4,
                alpha: 1
            };
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(camera.scale, camera.scale);
        ctx.translate(-camera.x, -camera.y);

        const themeColor = getComputedStyle(body).getPropertyValue('--accent-color').trim();
        const textColor = getComputedStyle(body).getPropertyValue('--text-color').trim();

        nodes.forEach(node => {
            if (camera.scale === 1) {
                node.x += node.vx;
                node.y += node.vy;
                if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
                if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
            }
            ctx.globalAlpha = node.alpha;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = themeColor;
            ctx.fill();
            ctx.font = '14px Inter';
            ctx.fillStyle = textColor;
            ctx.fillText(node.text, node.x + 10, node.y + 5);
        });

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
                if (dist < 150) {
                    ctx.globalAlpha = nodes[i].alpha * nodes[j].alpha * (1 - (dist / 150));
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.strokeStyle = themeColor;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        camera.x = canvas.width / 2;
        camera.y = canvas.height / 2;
        camera.scale = 1;
        createNodes();
        draw(); // Initial draw
    }

    ScrollTrigger.create({
        trigger: "#chapter-3",
        start: "top bottom",
        end: "bottom top",
        onEnter: () => {
            if (!animationFrameId) {
                const animate = () => {
                    draw();
                    animationFrameId = requestAnimationFrame(animate);
                };
                animate();
            }
        },
        onLeave: () => { cancelAnimationFrame(animationFrameId); animationFrameId = null; },
        onEnterBack: () => {
             if (!animationFrameId) {
                const animate = () => {
                    draw();
                    animationFrameId = requestAnimationFrame(animate);
                };
                animate();
            }
        },
        onLeaveBack: () => { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    });

    const zoomTarget = () => nodes.find(n => n.text === 'Distributed Systems');
    const zoomTimeline = gsap.timeline({
        scrollTrigger: {
            trigger: "#chapter-3",
            start: "top top",
            end: "+=200%",
            scrub: 1.5,
            pin: true,
        }
    });

    zoomTimeline.from("#chapter-3 h2", { opacity: 0, y: -50 });
    zoomTimeline.to(camera, {
        x: () => zoomTarget() ? zoomTarget().x : (canvas.width / 2),
        y: () => zoomTarget() ? zoomTarget().y : (canvas.height / 2),
        scale: 15,
        ease: "power2.inOut",
    }, ">+=0.5");
    zoomTimeline.to(nodes.filter(n => n.text !== 'Distributed Systems'), {
        alpha: 0,
        ease: "power2.inOut",
    }, "<");
    zoomTimeline.to("#skill-constellation", { opacity: 0 }, ">-=0.5");
    zoomTimeline.from("#chapter-4", { opacity: 0 }, "<");

    gsap.from(".timeline-item", {
        scrollTrigger: { trigger: "#chapter-4", start: "top 60%", end: "bottom 80%", scrub: 1 },
        opacity: 0, x: -50, stagger: 0.3
    });

    // --- Chapter 5: Dot Expansion Transition ---
    const expansionTimeline = gsap.timeline({
        scrollTrigger: {
            trigger: "#chapter-4",
            start: "bottom 90%",
            end: "+=150%",
            scrub: 1.5,
            pin: true,
        }
    });

    const lastDot = document.querySelector(".timeline-item:last-child .timeline-dot");

    expansionTimeline.to(".timeline-item h3, .timeline-item p, .timeline-item:not(:last-child) .timeline-dot, #chapter-4 h2", {
        opacity: 0,
        ease: "power1.in"
    });

    const scaleX = window.innerWidth / lastDot.offsetWidth;
    const scaleY = window.innerHeight / lastDot.offsetHeight;
    const scale = Math.max(scaleX, scaleY) * 1.2;

    expansionTimeline.to(lastDot, {
        scale: scale,
        backgroundColor: "var(--bg-color)",
        ease: "power2.inOut",
    }, "<+=0.2");

    expansionTimeline.from(".article-card", {
        opacity: 0,
        y: 50,
        scale: 0.95,
        stagger: 0.1,
        ease: "power2.out",
    }, "<+=0.5");

    // --- Chapter 6: Final Fade-in ---
    gsap.from("#chapter-6 > *", {
        scrollTrigger: {
            trigger: "#chapter-6",
            start: "top 80%",
            end: "top 50%",
            scrub: 1,
        },
        opacity: 0,
        y: 30,
        stagger: 0.3,
    });

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Initial setup
});