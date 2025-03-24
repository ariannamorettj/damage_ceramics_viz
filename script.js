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

// Percorso relativo al CSV
const csvFilePath = 'input_data_per_web/unified_dataset_ceramics_ver2.csv';

// Funzione per creare marker sulla mappa
function addMarkers(data) {
  data.forEach(row => {
    const inventaire = row["inventaire"];
    const countryCode = row["provenance (country code)"];
    const provenanceText = row["provenance"];

    if (countryCode && countryCoordinates[countryCode]) {
      const coords = countryCoordinates[countryCode];
      // Crea il marker
      const marker = L.marker(coords);
      // Aggiungi un popup
      marker.bindPopup(`<strong>Inventaire:</strong> ${inventaire}<br><strong>Provenance:</strong> ${provenanceText}`);
      // Aggiungi il marker al gruppo cluster
      markersCluster.addLayer(marker);
    }
  });
}

// Carica e parsa il CSV usando Papa Parse
Papa.parse(csvFilePath, {
  header: true,
  download: true,
  complete: function(results) {
    const data = results.data;
    addMarkers(data);
  },
  error: function(err) {
    console.error("Errore nel caricamento del CSV: ", err);
  }
});




// STACKED BAR CHART
// Palette coerente con la tua
const palette = [
  "#4793AF", "#FFC470", "#DD5746", "#8B322C", "#B36A5E", "#A64942", "#D99152"
];

// Funzione di normalizzazione per "% lacunaire"
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

// Struttura per raccogliere i dati
const groupCounts = {}; // { '% lacunaire': { 'matériau simplifié': count } }
const allMaterials = new Set();
const allLacuna = new Set();

// Carica e parsa il CSV
Papa.parse('input_data_per_web/unified_dataset_ceramics_ver2.csv', {
  header: true,
  download: true,
  complete: function(results) {
    results.data.forEach(row => {
      const rawLacuna = row["% lacunaire"];
      const material = row["matériau simplifié"];
      const lacuna = normalizeLacuna(rawLacuna);

      if (!lacuna || !material) return;

      allLacuna.add(lacuna);
      allMaterials.add(material);

      if (!groupCounts[lacuna]) {
        groupCounts[lacuna] = {};
      }
      groupCounts[lacuna][material] = (groupCounts[lacuna][material] || 0) + 1;
    });

    renderChart();
  },
  error: function(err) {
    console.error("Errore nel caricamento del CSV per il grafico: ", err);
  }
});

function renderChart() {
  const labels = ["0-10%", "10-25%", "25-50%", "50-75%", "75-100%", "intervallo", "altro"]
    .filter(label => allLacuna.has(label)); // filtra solo quelli presenti nei dati

  const sortedMaterials = Array.from(allMaterials).sort();
  const datasets = sortedMaterials.map((material, idx) => {
    return {
      label: material,
      data: labels.map(lacuna => (groupCounts[lacuna]?.[material] || 0)),
      backgroundColor: palette[idx % palette.length]
    };
  });

  const chartData = {
    labels: labels,
    datasets: datasets
  };

  const config = {
    type: 'bar',
    data: chartData,
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: '% Lacunaire per Matériau (dinamico)'
        }
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: '% Lacunaire'
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Numero di reperti'
          }
        }
      }
    }
  };

  new Chart(document.getElementById('lacunaChart'), config);
}