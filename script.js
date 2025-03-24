// Inizializza la mappa centrata in Europa
const map = L.map('map').setView([50, 10], 4);

// Aggiungi il layer di base OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Crea un gruppo per i marker cluster
const markersCluster = L.markerClusterGroup();
map.addLayer(markersCluster);

/* Dizionario delle coordinate dei paesi (basato su codici numerici) */
const countryCoordinates = {
  "250": [46.2276, 2.2137],    // Francia
  "380": [41.8719, 12.5674],   // Italia
  "276": [51.1657, 10.4515],   // Germania
  "724": [40.4637, -3.7492],   // Spagna
  "56":  [50.5039, 4.4699],    // Belgio
  "528": [52.1326, 5.2913],    // Paesi Bassi
  "246": [61.9241, 25.7482],   // Finlandia
  "756": [46.8182, 8.2275],    // Svizzera
  "156": [35.8617, 104.1954],  // Cina
  "364": [32.4279, 53.6880],   // Iran
  "356": [20.5937, 78.9629],   // India
  "368": [33.2232, 43.6793],   // Iraq
  "616": [51.9194, 19.1451],   // Polonia
  "620": [39.3999, -8.2245],   // Portogallo
  "818": [26.8206, 30.8025],   // Egitto
  "826": [55.3781, -3.4360],   // Regno Unito
  "642": [45.9432, 24.9668]    // Romania
};

const csvFilePath = 'input_data_per_web/unified_dataset_ceramics_ver2.csv';

const palette = ["#4793AF", "#FFC470", "#DD5746", "#8B322C", "#B36A5E", "#A64942", "#D99152"];
const groupCounts = {};
const allMaterials = new Set();
const allLacuna = new Set();

function normalizeLacuna(val) {
  if (!val) return "altro";
  val = val.toString().replace(',', '.').replace('%', '').trim();
  try {
    if (val.includes('<') && !val.includes('x')) {
      const num = parseFloat(val.replace('<', ''));
      if (num <= 10) return "0-10%";
      if (num <= 25) return "10-25%";
    }
    if (val.includes('x') || val.includes('-')) return "intervallo";
    const num = parseFloat(val);
    if (num <= 10) return "0-10%";
    if (num <= 25) return "10-25%";
    if (num <= 50) return "25-50%";
    if (num <= 75) return "50-75%";
    return "75-100%";
  } catch {
    return "altro";
  }
}

Papa.parse(csvFilePath, {
  header: true,
  download: true,
  complete: function(results) {
    const data = results.data;
    addMarkers(data);

    data.forEach(row => {
      const rawLacuna = row["% lacunaire"];
      const material = row["matériau simplifié"];
      const lacuna = normalizeLacuna(rawLacuna);

      if (!lacuna || !material) return;

      allLacuna.add(lacuna);
      allMaterials.add(material);

      if (!groupCounts[lacuna]) groupCounts[lacuna] = {};
      groupCounts[lacuna][material] = (groupCounts[lacuna][material] || 0) + 1;
    });

    renderChart();
    renderMaterialCards();
  },
  error: function(err) {
    console.error("Errore nel caricamento del CSV: ", err);
  }
});

function addMarkers(data) {
  data.forEach(row => {
    const inventaire = row["inventaire"];
    const countryCode = row["provenance (country code)"];
    const provenanceText = row["provenance"];

    if (countryCode && countryCoordinates[countryCode]) {
      const coords = countryCoordinates[countryCode];
      const marker = L.marker(coords);
      marker.bindPopup(`<strong>Inventaire:</strong> ${inventaire}<br><strong>Provenance:</strong> ${provenanceText}`);
      markersCluster.addLayer(marker);
    }
  });
}

function renderChart() {
  const labels = ["0-10%", "10-25%", "25-50%", "50-75%", "75-100%", "intervallo", "altro"].filter(label => allLacuna.has(label));
  const sortedMaterials = Array.from(allMaterials).sort();

  const datasets = sortedMaterials.map((material, idx) => {
    return {
      label: material,
      data: labels.map(lacuna => (groupCounts[lacuna]?.[material] || 0)),
      backgroundColor: palette[idx % palette.length]
    };
  });

  new Chart(document.getElementById('lacunaChart'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: '% Lacunaire per Matériau (dinamico)' }
      },
      scales: {
        x: { stacked: true, title: { display: true, text: '% Lacunaire' } },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Numero di reperti' } }
      }
    }
  });
}

function renderMaterialCards() {
  const container = document.getElementById("materialCardContainer");
  container.innerHTML = "";

  const colors = {
    "0-10%": "#4793AF",
    "10-25%": "#FFC470",
    "25-50%": "#DD5746",
    "50-75%": "#8B322C",
    "75-100%": "#B36A5E",
    "intervallo": "#A64942",
    "altro": "#D99152"
  };

  const labels = Object.keys(colors);
  const sortedMaterials = Array.from(allMaterials).sort();

  sortedMaterials.forEach(material => {
    const materialId = material.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const distribuzione = labels.map(lacuna => ({
      categoria: lacuna,
      count: groupCounts[lacuna]?.[material] || 0
    })).filter(entry => entry.count > 0);

    const imagePath = `assets/materials/${materialId}.jpg`;
    console.log(imagePath)

    // Card HTML
    const cardHTML = `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card h-100 shadow-sm" role="button" data-bs-toggle="modal" data-bs-target="#modal-${materialId}">
          <img src="${imagePath}" class="card-img-top" alt="${material}">
          <div class="card-body text-center">
            <h5 class="card-title">${material}</h5>
            <p class="text-muted small">Clicca per vedere la distribuzione</p>
          </div>
        </div>
      </div>
    `;

    // Modal HTML
    const modalHTML = `
      <div class="modal fade" id="modal-${materialId}" tabindex="-1" aria-labelledby="modalLabel-${materialId}" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header" style="background-color: #4793AF; color: white;">
              <h5 class="modal-title" id="modalLabel-${materialId}">Distribuzione lacunaire – ${material}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Chiudi"></button>
            </div>
            <div class="modal-body text-center">
              <canvas id="chart-${materialId}" width="400" height="400"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML("beforeend", cardHTML);
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Inizializza il grafico quando il modal viene aperto
    const targetModal = document.getElementById(`modal-${materialId}`);
    targetModal.addEventListener('shown.bs.modal', function () {
      const ctx = document.getElementById(`chart-${materialId}`).getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: distribuzione.map(d => d.categoria),
          datasets: [{
            data: distribuzione.map(d => d.count),
            backgroundColor: distribuzione.map(d => colors[d.categoria])
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            title: {
              display: true,
              text: `% Lacunaire – ${material}`
            }
          }
        }
      });
    }, { once: true });
  });
}