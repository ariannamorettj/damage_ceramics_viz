// Maximum number of fallback attempts for image filenames
const MAX_ATTEMPTS = 5;

// Path to the CSV file
const csvFilePath = 'input_data_per_web/unified_dataset_ceramics_ver6.csv';

// Dictionary to translate French material names to English
const materialTranslations = {
  "terre cuite": "Terracotta",
  "terraglia": "Creamware",
  "porcelaine": "Porcellain",
  "faïence": "Earthenware",
  "grés": "Stonewear",
  "quartz": "Quartz",
  "mixte": "Mix",
  "métal": "Metal",
  "mixte(terre cuite+quartz)": "Mix (Terracotta + Quartz)",
  "mixte (grés + métal)": "Mix (Stonewear + Metal)"
};

// Dictionary for background images (keys are the translated material names)
const backgroundImages = {
  "Earthenware": "assets/materials/fa-ence.jpg",
  "Stonewear": "assets/materials/gr-s.jpg",
  "Mix (Stonewear + Metal)": "assets/materials/mixte--gr-s---m-tal-.jpg",
  "Mix (Terracotta + Quartz)": "assets/materials/mixte-terre-cuite-quartz-.jpg",
  "Porcellain": "assets/materials/porceclaine.jpg",
  "Creamware": "assets/materials/terraglia.jpg",
  "Terracotta": "assets/materials/terre-cuite.jpg"
};

// Use Papa Parse to load the CSV file
Papa.parse(csvFilePath, {
  header: true,
  download: true,
  complete: function(results) {
    const data = results.data;
    // Filter for MIC collection rows: provenance_file starting with "faenza_"
    const micData = data.filter(row => row["provenance_file"] && row["provenance_file"].startsWith("faenza_"));
    // Group the rows by translated "matériau simplifié"
    const groups = groupByMaterial(micData);
    // Render the catalogue grouped by material
    renderCatalogue(groups);
  },
  error: function(err) {
    console.error("Error loading CSV: ", err);
  }
});

// Function to group rows by "matériau simplifié" using the translation dictionary
function groupByMaterial(data) {
  return data.reduce((groups, row) => {
    const originalMaterial = row["matériau simplifié"] || "Unknown";
    const materialKey = originalMaterial.trim().toLowerCase();
    // Translate the material name or fallback to the original value
    const translated = materialTranslations[materialKey] || originalMaterial;
    if (!groups[translated]) groups[translated] = [];
    groups[translated].push(row);
    return groups;
  }, {});
}

// Function to render the catalogue using Bootstrap collapse sections and cards
function renderCatalogue(groups) {
  const container = document.getElementById("catalogue-container");
  let html = '';

  for (const material in groups) {
    // Create a safe ID for the collapse component
    const safeId = material.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    // Set the background image if available
    const bgStyle = backgroundImages[material]
      ? `background: url('${backgroundImages[material]}') no-repeat center center; background-size: cover; padding: 20px; border-radius: 5px;`
      : '';
    // Add a dark overlay to ensure text readability if there's a background image
    const overlayStyle = backgroundImages[material]
      ? `background-color: rgba(0,0,0,0.5); padding: 10px; border-radius: 5px;`
      : '';

    html += `
      <div class="material-group mb-5" style="${bgStyle}">
        <div style="${overlayStyle}">
          <h3 class="text-white">${material}</h3>
          <button class="btn btn-primary mb-3" type="button" data-bs-toggle="collapse" data-bs-target="#group-${safeId}" aria-expanded="false" aria-controls="group-${safeId}">
            Show/Hide ${material} Items
          </button>
          <div class="collapse" id="group-${safeId}">
            <div class="row">
    `;

    groups[material].forEach(row => {
      // Extract metadata
      const inventaire = row["inventaire"] || "";
      const typologie = row["typologie"] || "";
      const datation = row["datation"] || "";
      const provenance = row["provenance"] || "";
      const nbFragments = row["nombre de fragements"] || "";
      const missingPercentage = row["% lacunaire"] || "";

      // Recupera il filename dall'apposita colonna (prendi il primo se ce ne sono più di uno)
      const picturesFilenames = row["pictures filenames"] || "";
      const firstFilename = picturesFilenames.split(/\r?\n/)[0].trim();

      // Derive image path: utilizza il filename preso dal CSV
      const basePath = "assets/catalogue/Faenza visualizazzioni";
      const imagePath = `${basePath}/${firstFilename}`;

      html += `
        <div class="col-md-4 mb-3">
          <div class="card h-100">
            <img src="${imagePath}" class="card-img-top" alt="Catalogue Number: ${inventaire}"
                 data-filename="${firstFilename}"
                 onerror="tryNextImage(this, '${basePath}', this.getAttribute('data-filename'));">
            <div class="card-body">
              <h5 class="card-title">${inventaire}</h5>
              <p class="card-text"><strong>Type:</strong> ${typologie}</p>
              <p class="card-text"><strong>Date:</strong> ${datation}</p>
              <p class="card-text"><strong>Provenance:</strong> ${provenance}</p>
              <p class="card-text"><strong>Fragments:</strong> ${nbFragments}</p>
              <p class="card-text"><strong>Missing %:</strong> ${missingPercentage}</p>
            </div>
          </div>
        </div>
      `;
    });

    html += `
            </div>
          </div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

// Helper function that is called when an image fails to load.
// It will try the next available file with pattern: "<filename> (n).JPG" for the MIC collection folder.
function tryNextImage(img, basePath, filename) {
  let attempt = parseInt(img.getAttribute('data-attempt')) || 0;
  attempt++;
  if (attempt > MAX_ATTEMPTS) {
    // Maximum attempts reached; use the alt image for MIC collection
    img.onerror = null;
    img.src = `${basePath}/alt_mic.png`;
    return;
  }
  img.setAttribute('data-attempt', attempt);
  // Update image source to try the next available filename (e.g., "filename (1).JPG")
  img.src = `${basePath}/${filename} (${attempt}).JPG`;
}