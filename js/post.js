document.addEventListener('DOMContentLoaded', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg') });

    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.position.z = 5;

    const starGeo = new THREE.BufferGeometry();
    const starCount = 5000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 100;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 });
    const stars = new THREE.Points(starGeo, starMaterial);
    scene.add(stars);

    function animate() {
        requestAnimationFrame(animate);
        stars.rotation.x += 0.0001;
        stars.rotation.y += 0.0001;
        renderer.render(scene, camera);
    }

    animate();

    const postContent = document.getElementById('post-content');
    const converter = new showdown.Converter();
    const urlParams = new URLSearchParams(window.location.search);
    const postFile = urlParams.get('post');

    if (postFile) {
        fetch(`posts/${postFile}`)
            .then(response => response.text())
            .then(text => {
                const content = text.split('---
').slice(2).join('---
');
                const html = converter.makeHtml(content);
                postContent.innerHTML = html;
            });
    }
});