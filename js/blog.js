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

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const postsContainer = document.getElementById('posts');
    const postFiles = ['post1.md', 'post2.md'];

    const promises = postFiles.map(file =>
        fetch(`posts/${file}`)
            .then(response => response.text())
            .then(text => {
                const frontMatter = text.split('---\n')[1];
                const title = frontMatter.match(/title: (.*)/)[1];
                const date = frontMatter.match(/date: (.*)/)[1];
                return { file, title, date };
            })
    );

    Promise.all(promises).then(posts => {
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.innerHTML = `<a href="post.html?post=${post.file}">${post.title}</a> - ${post.date}`;
            postsContainer.appendChild(postElement);
        });
    });
});