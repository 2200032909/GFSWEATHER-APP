/* =========================================================
   GFS WEATHER MAP
   ========================================================= */


/* =========================================================
   MAP
   ========================================================= */

const map = L.map('map', {
    zoomControl: true
}).setView([13, 80], 7);


L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 12,

        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">' +
            'OpenStreetMap</a> contributors. Data: NOAA GFS'
    }
).addTo(map);


/* =========================================================
   RAIN COLOR SCALE
   ========================================================= */

const STOPS = [
    [0.1, [120, 200, 255]],
    [1, [40, 120, 255]],
    [2.5, [40, 200, 90]],
    [5, [250, 230, 40]],
    [10, [255, 150, 30]],
    [20, [230, 40, 40]],
    [40, [170, 40, 200]]
];


function rainColor(v) {

    if (v < settings.rainThreshold) {
        return null;
    }

    for (let i = 1; i < STOPS.length; i++) {

        if (v <= STOPS[i][0]) {

            const [a, ca] = STOPS[i - 1];
            const [b, cb] = STOPS[i];

            const t =
                (v - a) /
                (b - a);

            return ca.map(
                (c, k) =>
                    Math.round(
                        c +
                        (cb[k] - c) * t
                    )
            );
        }
    }

    return STOPS[
        STOPS.length - 1
    ][1];
}


/* =========================================================
   RAIN LEGEND
   ========================================================= */

document.getElementById('ramp').style.background =
    'linear-gradient(90deg,' +
    STOPS
        .map(
            s =>
                `rgb(${s[1][0]},${s[1][1]},${s[1][2]})`
        )
        .join(',') +
    ')';


/* =========================================================
   CANVAS
   ========================================================= */

function mkCanvas() {

    const c =
        document.createElement('canvas');

    c.className = 'ov';

    map
        .getContainer()
        .appendChild(c);

    return c;
}


const rc = mkCanvas();
const wc = mkCanvas();


function resize() {

    const s = map.getSize();

    [rc, wc].forEach(c => {

        c.width = s.x;
        c.height = s.y;

    });
}


/* =========================================================
   GLOBAL DATA
   ========================================================= */

let D = null;

let step = 0;

let timer = null;

let started = false;

const off =
    document.createElement('canvas');


/* =========================================================
   CUSTOMIZATION SETTINGS
   ========================================================= */

const DEFAULT_SETTINGS = {

    rainOpacity: 1,

    rainThreshold: 0.1,

    windColor: '#0a236e',

    windSize: 1.3,

    windSpeed: 0.35,

    windTrail: 8,

    particleCount: 700,

    windOpacity: 0.9,

    windColorMode: 'single'

};


const settings = {

    ...DEFAULT_SETTINGS
};


/* =========================================================
   DOM REFERENCES
   ========================================================= */

const customRain =
    document.getElementById('customRain');

const customWind =
    document.getElementById('customWind');

const rainOpacity =
    document.getElementById('rainOpacity');

const rainThreshold =
    document.getElementById('rainThreshold');

const windColor =
    document.getElementById('windColor');

const windSize =
    document.getElementById('windSize');

const windSpeed =
    document.getElementById('windSpeed');

const windTrail =
    document.getElementById('windTrail');

const particleCount =
    document.getElementById('particleCount');

const windOpacity =
    document.getElementById('windOpacity');

const windColorMode =
    document.getElementById('windColorMode');


/* =========================================================
   UPDATE DISPLAY VALUES
   ========================================================= */

function updateSettingLabels() {

    document.getElementById(
        'rainOpacityValue'
    ).textContent =
        `${rainOpacity.value}%`;


    document.getElementById(
        'rainThresholdValue'
    ).textContent =
        `${Number(rainThreshold.value).toFixed(1)} mm`;


    document.getElementById(
        'windSizeValue'
    ).textContent =
        Number(windSize.value).toFixed(1);


    document.getElementById(
        'windSpeedValue'
    ).textContent =
        Number(windSpeed.value).toFixed(2);


    document.getElementById(
        'windTrailValue'
    ).textContent =
        windTrail.value;


    document.getElementById(
        'particleCountValue'
    ).textContent =
        particleCount.value;


    document.getElementById(
        'windOpacityValue'
    ).textContent =
        `${windOpacity.value}%`;
}


/* =========================================================
   APPLY SETTINGS
   ========================================================= */

function readSettings() {

    settings.rainOpacity =
        Number(rainOpacity.value) / 100;


    settings.rainThreshold =
        Number(rainThreshold.value);


    settings.windColor =
        windColor.value;


    settings.windSize =
        Number(windSize.value);


    settings.windSpeed =
        Number(windSpeed.value);


    settings.windTrail =
        Number(windTrail.value);


    settings.particleCount =
        Number(particleCount.value);


    settings.windOpacity =
        Number(windOpacity.value) / 100;


    settings.windColorMode =
        windColorMode.value;


    updateSettingLabels();

    resizeParticles();

    drawRain();
}


/* =========================================================
   PARTICLES
   ========================================================= */

let P = [];


function spawn(p) {

    if (!D) {
        return;
    }

    p.lat =
        D.lats[D.lats.length - 1] +
        Math.random() *
        (
            D.lats[0] -
            D.lats[D.lats.length - 1]
        );


    p.lon =
        D.lons[0] +
        Math.random() *
        (
            D.lons[D.lons.length - 1] -
            D.lons[0]
        );


    p.age =
        Math.floor(
            Math.random() * 80
        );


    p.prev = null;
}


/* =========================================================
   RESIZE PARTICLE ARRAY
   ========================================================= */

function resizeParticles() {

    const target =
        settings.particleCount;


    while (P.length < target) {

        const p = {};

        spawn(p);

        P.push(p);
    }


    if (P.length > target) {

        P.length = target;
    }
}


/* =========================================================
   TIME
   ========================================================= */

const dtf =
    new Intl.DateTimeFormat(
        'en-IN',
        {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Kolkata'
        }
    );


function timeLabel(i) {

    const t =
        new Date(
            new Date(D.run).getTime() +
            D.hours[i] * 3600e3
        );


    return (
        dtf.format(t) +
        ' IST (f' +
        String(
            D.hours[i]
        ).padStart(3, '0') +
        ')'
    );
}


/* =========================================================
   BILINEAR INTERPOLATION
   ========================================================= */

function bil(grid, lat, lon) {

    if (!grid || !D) {
        return null;
    }


    const la = D.lats;

    const lo = D.lons;


    const ny =
        la.length;

    const nx =
        lo.length;


    if (
        ny < 2 ||
        nx < 2
    ) {
        return null;
    }


    const fy =
        (
            (la[0] - lat) /
            (la[0] - la[ny - 1])
        ) *
        (ny - 1);


    const fx =
        (
            (lon - lo[0]) /
            (lo[nx - 1] - lo[0])
        ) *
        (nx - 1);


    if (
        fy < 0 ||
        fx < 0 ||
        fy > ny - 1 ||
        fx > nx - 1
    ) {
        return null;
    }


    const y0 =
        Math.min(
            Math.floor(fy),
            ny - 2
        );


    const x0 =
        Math.min(
            Math.floor(fx),
            nx - 2
        );


    const ty =
        fy - y0;

    const tx =
        fx - x0;


    return (
        grid[y0][x0] *
        (1 - tx) *
        (1 - ty)

        +

        grid[y0][x0 + 1] *
        tx *
        (1 - ty)

        +

        grid[y0 + 1][x0] *
        (1 - tx) *
        ty

        +

        grid[y0 + 1][x0 + 1] *
        tx *
        ty
    );
}


/* =========================================================
   RAIN DRAWING
   ========================================================= */

function drawRain() {

    const ctx =
        rc.getContext('2d');


    ctx.clearRect(
        0,
        0,
        rc.width,
        rc.height
    );


    if (
        !D ||
        !document.getElementById('tRain').checked ||
        !customRain.checked
    ) {
        return;
    }


    const ny =
        D.lats.length;

    const nx =
        D.lons.length;


    const g =
        D.rain[step];


    off.width = nx;

    off.height = ny;


    const octx =
        off.getContext('2d');


    const img =
        octx.createImageData(
            nx,
            ny
        );


    for (
        let y = 0;
        y < ny;
        y++
    ) {

        for (
            let x = 0;
            x < nx;
            x++
        ) {

            const value =
                Number(g[y][x]) || 0;


            const c =
                rainColor(value);


            const i =
                (y * nx + x) * 4;


            if (c) {

                img.data[i] =
                    c[0];

                img.data[i + 1] =
                    c[1];

                img.data[i + 2] =
                    c[2];


                img.data[i + 3] =
                    Math.min(
                        210,
                        (
                            90 +
                            value * 25
                        )
                    ) *
                    settings.rainOpacity;

            }

        }

    }


    octx.putImageData(
        img,
        0,
        0
    );


    const hx =
        (
            D.lons[1] -
            D.lons[0]
        ) / 2;


    const hy =
        (
            D.lats[0] -
            D.lats[1]
        ) / 2;


    const nw =
        map.latLngToContainerPoint(
            [
                D.lats[0] + hy,
                D.lons[0] - hx
            ]
        );


    const se =
        map.latLngToContainerPoint(
            [
                D.lats[ny - 1] - hy,
                D.lons[nx - 1] + hx
            ]
        );


    ctx.imageSmoothingEnabled =
        true;


    ctx.imageSmoothingQuality =
        'high';


    ctx.drawImage(
        off,
        nw.x,
        nw.y,
        se.x - nw.x,
        se.y - nw.y
    );
}


/* =========================================================
   WIND COLOR
   ========================================================= */

function getWindColor(speed) {

    if (
        settings.windColorMode ===
        'single'
    ) {

        return settings.windColor;
    }


    /*
       Speed-based color scale:

       0 m/s   -> light blue
       5 m/s   -> blue
       10 m/s  -> green
       15 m/s  -> yellow
       20+ m/s -> red
    */

    if (speed < 5) {
        return '#64b5f6';
    }

    if (speed < 10) {
        return '#1976d2';
    }

    if (speed < 15) {
        return '#00a878';
    }

    if (speed < 20) {
        return '#fbc02d';
    }

    return '#e53935';
}


/* =========================================================
   WIND ANIMATION
   ========================================================= */

function tickWind() {

    const ctx =
        wc.getContext('2d');


    if (
        !D ||
        !document.getElementById('tWind').checked ||
        !customWind.checked
    ) {

        ctx.clearRect(
            0,
            0,
            wc.width,
            wc.height
        );


        requestAnimationFrame(
            tickWind
        );

        return;
    }


    /*
       Trail fade.

       Larger trail value =
       particles stay visible longer.
    */

    const fade =
        Math.max(
            0.01,
            Math.min(
                0.40,
                1 /
                settings.windTrail
            )
        );


    ctx.globalCompositeOperation =
        'destination-out';


    ctx.fillStyle =
        `rgba(0,0,0,${fade})`;


    ctx.fillRect(
        0,
        0,
        wc.width,
        wc.height
    );


    ctx.globalCompositeOperation =
        'source-over';


    ctx.lineWidth =
        settings.windSize;


    const U =
        D.u &&
            D.u[step]
            ? D.u[step]
            : null;


    const V =
        D.v &&
            D.v[step]
            ? D.v[step]
            : null;


    if (!U || !V) {

        requestAnimationFrame(
            tickWind
        );

        return;
    }


    /*
       Wind movement.

       settings.windSpeed controls
       how quickly particles move.
    */

    const k =
        settings.windSpeed *
        Math.pow(
            2,
            map.getZoom() - 7
        );


    for (const p of P) {

        const u =
            bil(
                U,
                p.lat,
                p.lon
            );


        const v =
            bil(
                V,
                p.lat,
                p.lon
            );


        if (
            u === null ||
            v === null ||
            p.age++ > 90
        ) {

            spawn(p);

            continue;
        }


        const a =
            map.latLngToContainerPoint(
                [
                    p.lat,
                    p.lon
                ]
            );


        const speed =
            Math.hypot(
                u,
                v
            );


        const b = {

            x:
                a.x +
                u * k,

            y:
                a.y -
                v * k

        };


        const ll =
            map.containerPointToLatLng(
                [
                    b.x,
                    b.y
                ]
            );


        if (p.prev) {

            const color =
                getWindColor(
                    speed
                );


            /*
               Speed also affects
               opacity slightly.
            */

            const alpha =
                Math.min(
                    settings.windOpacity,
                    0.25 +
                    speed / 20
                );


            /*
               Convert hex color
               to RGB for opacity.
            */

            const rgb =
                hexToRgb(color);


            ctx.strokeStyle =
                `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;


            ctx.beginPath();


            ctx.moveTo(
                a.x,
                a.y
            );


            ctx.lineTo(
                b.x,
                b.y
            );


            ctx.stroke();

        }


        p.prev = true;


        p.lat =
            ll.lat;

        p.lon =
            ll.lng;


        /*
           Respawn particles
           outside the map area.
        */

        if (
            p.lat < D.lats[D.lats.length - 1] ||
            p.lat > D.lats[0] ||
            p.lon < D.lons[0] ||
            p.lon > D.lons[D.lons.length - 1]
        ) {

            spawn(p);
        }

    }


    requestAnimationFrame(
        tickWind
    );
}


/* =========================================================
   HEX -> RGB
   ========================================================= */

function hexToRgb(hex) {

    const clean =
        hex.replace(
            '#',
            ''
        );


    const value =
        parseInt(
            clean,
            16
        );


    return {

        r:
            (value >> 16) & 255,

        g:
            (value >> 8) & 255,

        b:
            value & 255

    };
}


/* =========================================================
   TIMELINE
   ========================================================= */

function setStep(i) {

    if (!D) {
        return;
    }


    step =
        Math.max(
            0,
            Math.min(
                i,
                D.hours.length - 1
            )
        );


    document.getElementById(
        'slider'
    ).value = step;


    document.getElementById(
        'time'
    ).textContent =
        timeLabel(step);


    drawRain();


    /*
       Reset wind trails
       when forecast changes.
    */

    const ctx =
        wc.getContext('2d');


    ctx.clearRect(
        0,
        0,
        wc.width,
        wc.height
    );


    P.forEach(
        p => p.prev = null
    );
}


/* =========================================================
   PLAY / PAUSE
   ========================================================= */

function play() {

    const button =
        document.getElementById(
            'play'
        );


    if (!D) {
        return;
    }


    if (timer) {

        clearInterval(timer);

        timer = null;

        button.textContent =
            'Play';

        return;
    }


    button.textContent =
        'Pause';


    function startTimer() {

        timer =
            setInterval(
                () => {

                    setStep(
                        (step + 1) %
                        D.hours.length
                    );

                },
                Number(
                    document.getElementById(
                        'speed'
                    ).value
                )
            );
    }


    startTimer();


    document.getElementById(
        'speed'
    ).onchange = () => {

        if (timer) {

            clearInterval(
                timer
            );

            startTimer();
        }

    };
}


/* =========================================================
   CLICK POPUP
   ========================================================= */

map.on(
    'click',
    e => {

        if (!D) {
            return;
        }


        const clickLat =
            e.latlng.lat;

        const clickLon =
            e.latlng.lng;


        const minLat =
            Math.min(
                ...D.lats
            );

        const maxLat =
            Math.max(
                ...D.lats
            );

        const minLon =
            Math.min(
                ...D.lons
            );

        const maxLon =
            Math.max(
                ...D.lons
            );


        /*
           Outside forecast box
        */

        if (
            clickLat < minLat ||
            clickLat > maxLat ||
            clickLon < minLon ||
            clickLon > maxLon
        ) {

            L.popup()

                .setLatLng(
                    e.latlng
                )

                .setContent(`

                    <div class="weather-popup">

                        <div class="weather-popup-title">
                            📍 Outside Forecast Area
                        </div>

                        <hr>

                        Latitude:
                        ${clickLat.toFixed(4)}°<br>

                        Longitude:
                        ${clickLon.toFixed(4)}°

                    </div>

                `)

                .openOn(map);


            return;
        }


        /*
           Find nearest GFS grid point
        */

        let latIndex = 0;

        let lonIndex = 0;


        let smallestLatDifference =
            Infinity;

        let smallestLonDifference =
            Infinity;


        for (
            let i = 0;
            i < D.lats.length;
            i++
        ) {

            const difference =
                Math.abs(
                    D.lats[i] -
                    clickLat
                );


            if (
                difference <
                smallestLatDifference
            ) {

                smallestLatDifference =
                    difference;

                latIndex =
                    i;
            }

        }


        for (
            let i = 0;
            i < D.lons.length;
            i++
        ) {

            const difference =
                Math.abs(
                    D.lons[i] -
                    clickLon
                );


            if (
                difference <
                smallestLonDifference
            ) {

                smallestLonDifference =
                    difference;

                lonIndex =
                    i;
            }

        }


        const gridLat =
            D.lats[latIndex];

        const gridLon =
            D.lons[lonIndex];


        /*
           Current rainfall
        */

        const rain =
            Number(
                D.rain[step][latIndex][lonIndex]
            ) || 0;


        /*
           Current wind
        */

        const u =
            D.u &&
                D.u[step] &&
                D.u[step][latIndex]

                ? Number(
                    D.u[step][latIndex][lonIndex]
                ) || 0

                : 0;


        const v =
            D.v &&
                D.v[step] &&
                D.v[step][latIndex]

                ? Number(
                    D.v[step][latIndex][lonIndex]
                ) || 0

                : 0;


        /*
           Wind speed
        */

        const windSpeedValue =
            Math.sqrt(
                u * u +
                v * v
            );


        /*
           Wind direction FROM
        */

        let direction =
            (
                Math.atan2(
                    -u,
                    -v
                ) *
                180 /
                Math.PI +
                360
            ) % 360;


        /*
           Compass direction
        */

        const compassDirections = [

            'N',
            'NNE',
            'NE',
            'ENE',

            'E',
            'ESE',
            'SE',
            'SSE',

            'S',
            'SSW',
            'SW',
            'WSW',

            'W',
            'WNW',
            'NW',
            'NNW'

        ];


        const compass =
            compassDirections[
            Math.round(
                direction /
                22.5
            ) % 16
            ];


        /*
           Total rainfall
        */

        let totalRain = 0;


        for (
            let i = 0;
            i <= step;
            i++
        ) {

            const value =
                bil(
                    D.rain[i],
                    clickLat,
                    clickLon
                );


            if (
                value !== null &&
                Number.isFinite(value)
            ) {

                totalRain +=
                    value;
            }

        }


        /*
           Forecast hour
        */

        const forecastHour =
            D.hours[step];


        /*
           Forecast time
        */

        const forecastTime =
            timeLabel(step);


        /*
           Popup
        */

        const popupHtml = `

            <div class="weather-popup">

                <div class="weather-popup-title">
                    🌦 Weather Information
                </div>

                <div class="weather-popup-subtitle">
                    Forecast hour:
                    F${String(forecastHour).padStart(3, '0')}
                </div>

                <hr>

                <b>📍 Location</b><br>

                Latitude:
                <strong>
                    ${clickLat.toFixed(4)}°N
                </strong>
                <br>

                Longitude:
                <strong>
                    ${clickLon.toFixed(4)}°E
                </strong>

                <br>

                <small>

                    Nearest GFS grid:
                    ${gridLat.toFixed(2)}°N,
                    ${gridLon.toFixed(2)}°E

                </small>


                <hr>


                <b>🕐 Forecast Time</b><br>

                ${forecastTime}


                <hr>


                <b>🌧 Rainfall</b><br>

                Rain this hour:
                <strong>
                    ${rain.toFixed(2)} mm
                </strong>

                <br>

                Total rainfall so far:
                <strong>
                    ${totalRain.toFixed(2)} mm
                </strong>


                <hr>


                <b>💨 Wind</b><br>

                Wind speed:
                <strong>
                    ${windSpeedValue.toFixed(2)} m/s
                </strong>

                <br>

                U component:
                ${u.toFixed(2)} m/s

                <br>

                V component:
                ${v.toFixed(2)} m/s

                <br>

                Direction:
                <strong>
                    ${compass}
                </strong>

                (${direction.toFixed(0)}°)


                <br>

                <small>
                    Direction indicates where
                    the wind is coming from.
                </small>

            </div>

        `;


        L.popup({
            maxWidth: 320
        })

            .setLatLng(
                e.latlng
            )

            .setContent(
                popupHtml
            )

            .openOn(map);

    }
);


/* =========================================================
   MAP MOVEMENT
   ========================================================= */

[
    'move',
    'zoom',
    'resize'
].forEach(
    ev => {

        map.on(
            ev,
            () => {

                drawRain();

                P.forEach(
                    p =>
                        p.prev = null
                );

            }
        );

    }
);


map.on(
    'resize',
    resize
);


/* =========================================================
   RAIN CONTROLS
   ========================================================= */

document.getElementById(
    'tRain'
).onchange = () => {

    customRain.checked =
        document.getElementById(
            'tRain'
        ).checked;


    drawRain();
};


customRain.onchange = () => {

    document.getElementById(
        'tRain'
    ).checked =
        customRain.checked;


    drawRain();
};


/* =========================================================
   WIND CONTROLS
   ========================================================= */

document.getElementById(
    'tWind'
).onchange = () => {

    customWind.checked =
        document.getElementById(
            'tWind'
        ).checked;

};


customWind.onchange = () => {

    document.getElementById(
        'tWind'
    ).checked =
        customWind.checked;

};


/* =========================================================
   CUSTOMIZATION INPUTS
   ========================================================= */

[
    rainOpacity,
    rainThreshold,
    windColor,
    windSize,
    windSpeed,
    windTrail,
    particleCount,
    windOpacity,
    windColorMode

].forEach(
    element => {

        element.addEventListener(
            'input',
            readSettings
        );


        element.addEventListener(
            'change',
            readSettings
        );

    }
);


/* =========================================================
   CUSTOMIZATION PANEL COLLAPSE
   ========================================================= */

document.getElementById(
    'customToggle'
).onclick = () => {

    const body =
        document.getElementById(
            'customBody'
        );

    const button =
        document.getElementById(
            'customToggle'
        );


    if (
        body.style.display ===
        'none'
    ) {

        body.style.display =
            'block';

        button.textContent =
            '−';

        button.title =
            'Collapse';

    } else {

        body.style.display =
            'none';

        button.textContent =
            '+';

        button.title =
            'Expand';

    }

};


/* =========================================================
   RESET CUSTOMIZATION
   ========================================================= */

document.getElementById(
    'resetCustomization'
).onclick = () => {

    /*
       Rain
    */

    rainOpacity.value = 100;

    rainThreshold.value = 0.1;


    /*
       Wind
    */

    windColor.value =
        DEFAULT_SETTINGS.windColor;

    windSize.value =
        DEFAULT_SETTINGS.windSize;

    windSpeed.value =
        DEFAULT_SETTINGS.windSpeed;

    windTrail.value =
        DEFAULT_SETTINGS.windTrail;

    particleCount.value =
        DEFAULT_SETTINGS.particleCount;

    windOpacity.value =
        DEFAULT_SETTINGS.windOpacity * 100;


    windColorMode.value =
        DEFAULT_SETTINGS.windColorMode;


    /*
       Layer visibility
    */

    customRain.checked = true;

    customWind.checked = true;

    document.getElementById(
        'tRain'
    ).checked = true;

    document.getElementById(
        'tWind'
    ).checked = true;


    readSettings();

};


/* =========================================================
   PLAY BUTTON
   ========================================================= */

document.getElementById(
    'play'
).onclick = play;


/* =========================================================
   TIMELINE SLIDER
   ========================================================= */

document.getElementById(
    'slider'
).oninput = e => {

    setStep(
        Number(e.target.value)
    );

};


/* =========================================================
   INITIAL RESIZE
   ========================================================= */

resize();


/* =========================================================
   LOAD WEATHER DATA
   ========================================================= */

function showMsg(t) {

    const m =
        document.getElementById(
            'msg'
        );


    m.style.display =
        t
            ? 'block'
            : 'none';


    m.textContent =
        t || '';
}


/* =========================================================
   LOAD WEATHER
   ========================================================= */

function loadWeather() {

    return fetch(
        '/api/weather'
    )

        .then(
            r => {

                if (!r.ok) {
                    throw 0;
                }

                return r.json();

            }
        )

        .then(
            d => {

                D = d;


                /*
                   Run display
                */

                document.getElementById(
                    'run'
                ).textContent =
                    'run ' +
                    d.run.slice(
                        0,
                        10
                    ) +
                    ' ' +
                    d.run.slice(
                        11,
                        13
                    ) +
                    'Z';


                /*
                   Timeline
                */

                const slider =
                    document.getElementById(
                        'slider'
                    );


                slider.max =
                    d.hours.length - 1;


                /*
                   Create particles
                */

                P.length = 0;


                for (
                    let i = 0;
                    i <
                    settings.particleCount;
                    i++
                ) {

                    const p = {};

                    spawn(p);

                    P.push(p);

                }


                /*
                   Fit map
                */

                map.fitBounds(

                    [
                        [
                            d.lats[
                            d.lats.length - 1
                            ],

                            d.lons[0]
                        ],

                        [
                            d.lats[0],

                            d.lons[
                            d.lons.length - 1
                            ]
                        ]
                    ],

                    {
                        padding:
                            [40, 40]
                    }

                );


                /*
                   First step
                */

                setStep(0);


                showMsg('');


                /*
                   Start wind animation
                */

                if (!started) {

                    started = true;

                    tickWind();

                }

            }
        )

        .catch(
            () => {

                showMsg(
                    'No data yet. Pick a run ' +
                    '(or leave "Latest run") ' +
                    'and press "Download and build".'
                );

            }
        );
}


/* =========================================================
   STATUS POLLING
   ========================================================= */

async function poll() {

    try {

        const response =
            await fetch(
                '/api/status'
            );


        const s =
            await response.json();


        document.getElementById(
            'st'
        ).textContent =

            s.state === 'Idle'

                ? ''

                :

                `${s.state}: ${s.message}` +
                (
                    s.total
                        ? ` (${s.done}/${s.total})`
                        : ''
                );


        /*
           Job still running
        */

        if (
            s.state ===
            'Downloading' ||
            s.state ===
            'Processing'
        ) {

            setTimeout(
                poll,
                1000
            );

            return;
        }


        /*
           Job completed
        */

        if (
            s.state ===
            'Done'
        ) {

            await loadWeather();

        }


    } catch (e) {

        /*
           Ignore temporary
           connection errors.
        */

    }

}


/* =========================================================
   DOWNLOAD / BUILD BUTTON
   ========================================================= */

document.getElementById(
    'go'
).onclick = async () => {

    const q =
        new URLSearchParams();


    const d =
        document.getElementById(
            'date'
        ).value.replaceAll(
            '-',
            ''
        );


    const c =
        document.getElementById(
            'cycle'
        ).value;


    if (d) {
        q.set(
            'date',
            d
        );
    }


    if (c) {
        q.set(
            'cycle',
            c
        );
    }


    try {

        const response =
            await fetch(
                '/api/download?' +
                q.toString(),
                {
                    method: 'POST'
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showMsg(
                result.error ||
                'Unable to start download.'
            );

            return;
        }


        showMsg('');

        poll();


    } catch (error) {

        showMsg(
            'Unable to connect to the server.'
        );

    }

};


/* =========================================================
   INITIAL SETTINGS
   ========================================================= */

readSettings();


/* =========================================================
   INITIAL WEATHER LOAD
   ========================================================= */

loadWeather();


/* =========================================================
   INITIAL STATUS LOAD
   ========================================================= */

poll();