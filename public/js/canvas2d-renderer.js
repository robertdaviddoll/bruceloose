// ---------- Fallback renderer ----------
// Some machines (often Linux with a blocklisted GPU driver) have WebGL turned off.
// Every mesh in this game is a flat colored rectangle, circle or triangle, so this
// draws the same three.js scene graph with the plain 2D canvas API instead.
class Canvas2DRenderer {
  constructor() {
    this.domElement = document.createElement('canvas');
    this.ctx = this.domElement.getContext('2d');
    this.pr = 1; this.w = 1; this.h = 1; this.list = [];
  }
  setPixelRatio(p) { this.pr = p; }
  setSize(w, h) {
    this.w = w; this.h = h;
    this.domElement.width = Math.round(w * this.pr); this.domElement.height = Math.round(h * this.pr);
    this.domElement.style.width = w + 'px'; this.domElement.style.height = h + 'px';
  }
  style(m) { return m.userData.css || (m.userData.css = m.color.getStyle()); }
  render(scene, camera) {
    const { ctx, pr, w, h } = this;
    scene.updateMatrixWorld();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = scene.background ? scene.background.getStyle() : '#000';
    ctx.fillRect(0, 0, this.domElement.width, this.domElement.height);
    const sx = w / (camera.right - camera.left), sy = h / (camera.top - camera.bottom);
    const cx = camera.position.x, cy = camera.position.y;
    const hw = (camera.right - camera.left) / 2, hh = (camera.top - camera.bottom) / 2;
    const list = this.list; list.length = 0;
    let i = 0;
    scene.traverseVisible((o) => {
      if (!o.isMesh) return;
      const e = o.matrixWorld.elements, p = o.geometry.parameters || {};
      // cull anything fully off screen
      let ex, ey;
      if (o.geometry.type === 'PlaneGeometry') { ex = 0.5 * (Math.abs(e[0]) + Math.abs(e[4])); ey = 0.5 * (Math.abs(e[1]) + Math.abs(e[5])); }
      else if (o.geometry.type === 'CircleGeometry') { ex = ey = p.radius * (Math.abs(e[0]) + Math.abs(e[4])); }
      else { ex = ey = Infinity; }
      if (Math.abs(e[12] - cx) - ex > hw || Math.abs(e[13] - cy) - ey > hh) return;
      list.push({ o, z: e[14], i: i++ });
    });
    list.sort((a, b) => a.z - b.z || a.i - b.i);
    for (const { o } of list) {
      const e = o.matrixWorld.elements;
      ctx.setTransform(pr * sx * e[0], -pr * sy * e[1], pr * sx * e[4], -pr * sy * e[5],
                       pr * (sx * (e[12] - cx) + w / 2), pr * (h / 2 - sy * (e[13] - cy)));
      ctx.fillStyle = this.style(o.material);
      const g = o.geometry;
      if (g.type === 'PlaneGeometry') {
        ctx.fillRect(-g.parameters.width / 2, -g.parameters.height / 2, g.parameters.width, g.parameters.height);
      } else if (g.type === 'CircleGeometry') {
        ctx.beginPath(); ctx.arc(0, 0, g.parameters.radius, 0, Math.PI * 2); ctx.fill();
      } else {
        const a = g.attributes.position.array;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]);
        for (let k = 3; k < a.length; k += 3) ctx.lineTo(a[k], a[k + 1]);
        ctx.closePath(); ctx.fill();
      }
    }
  }
}
