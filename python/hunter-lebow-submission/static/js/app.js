/**
 * Credit Ratings Explorer
 * 
 * A modern web application for comparing sovereign credit ratings
 * across countries from major rating agencies.
 * 
 * Author: Hunter Lebow
 */

// Global variables
let countries = [];
let selectedCountries = [];

/**
 * Initialize the application when the DOM is fully loaded
 */
document.addEventListener("DOMContentLoaded", function () {
  loadCountries();
  setupEventListeners();
});

/**
 * Set up event listeners for user interactions
 */
function setupEventListeners() {
  document
    .getElementById("countrySearch")
    .addEventListener("input", filterCountries);
  
  document
    .getElementById("compareButton")
    .addEventListener("click", compareCountries);
}

/**
 * Load available countries from the API
 */
function loadCountries() {
  fetch("/api/countries")
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (Array.isArray(data)) {
        countries = data;
        renderCountriesList();
      } else if (data.error) {
        console.error("API error:", data.error);
        showError(`Failed to load countries: ${data.error}`);
      } else {
        console.error("Unexpected data format:", data);
        showError("Failed to load countries. Unexpected data format.");
      }
    })
    .catch(error => {
      console.error("Error loading countries:", error);
      showError("Failed to load countries. Please try again.");
    });
}

/**
 * Display an error message to the user
 */
function showError(message) {
  alert(message);
}

/**
 * Render the list of available countries
 */
function renderCountriesList() {
  const countriesList = document.getElementById("countriesList");
  countriesList.innerHTML = "";

  if (!Array.isArray(countries) || countries.length === 0) {
    countriesList.innerHTML =
      '<p class="text-center text-muted">No countries available.</p>';
    return;
  }
  
  const countryItemsContainer = document.createElement("div");
  countryItemsContainer.className = "country-items-container";
  
  countries.forEach(country => {
    if (!country || !country.Country) {
      return;
    }

    const countryItem = document.createElement("div");
    countryItem.className = "country-item";
    countryItem.textContent = country.Country;
    countryItem.dataset.country = country.Country;

    // Highlight selected countries
    if (selectedCountries.includes(country.Country)) {
      countryItem.classList.add("active");
    }

    countryItem.addEventListener("click", function () {
      toggleCountrySelection(country.Country);
    });

    countryItemsContainer.appendChild(countryItem);
  });
  
  countriesList.appendChild(countryItemsContainer);
}

/**
 * Filter countries based on search input
 */
function filterCountries() {
  const searchTerm = document
    .getElementById("countrySearch")
    .value.toLowerCase();
  
  const countryItems = document.querySelectorAll(".country-item");

  countryItems.forEach(item => {
    const countryName = item.textContent.toLowerCase();
    item.style.display = countryName.includes(searchTerm) ? "block" : "none";
  });
}

/**
 * Toggle selection of a country
 */
function toggleCountrySelection(country) {
  const index = selectedCountries.indexOf(country);
  
  if (index === -1) {
    // Add country if not already selected (limit to 2)
    if (selectedCountries.length < 2) {
      selectedCountries.push(country);
    } else {
      showError("You can only select up to 2 countries at a time.");
      return;
    }
  } else {
    // Remove country if already selected
    selectedCountries.splice(index, 1);
  }
  
  // Update UI
  updateSelectedCountriesUI();
  renderCountriesList();
}

/**
 * Update the UI to show selected countries
 */
function updateSelectedCountriesUI() {
  const selectedCountriesContainer = document.getElementById("selectedCountries");
  
  if (selectedCountries.length === 0) {
    selectedCountriesContainer.innerHTML = `
      <p class="text-gray-500">Select two countries to compare.</p>
    `;
    document.getElementById("compareButton").classList.add("hidden");
    return;
  }
  
  let html = `<div class="selected-countries-container">`;
  
  selectedCountries.forEach(country => {
    html += `
      <div class="selected-country-badge">
        <span>${country}</span>
        <button class="remove-country-btn" onclick="toggleCountrySelection('${country}')">×</button>
      </div>
    `;
  });
  
  html += `</div>`;
  selectedCountriesContainer.innerHTML = html;
  
  // Show compare button if at least 2 countries are selected
  const compareButton = document.getElementById("compareButton");
  if (selectedCountries.length >= 2) {
    compareButton.classList.remove("hidden");
  } else {
    compareButton.classList.add("hidden");
  }
}

/**
 * Compare selected countries
 */
function compareCountries() {
  if (selectedCountries.length < 2) {
    showError("Please select 2 countries to compare.");
    return;
  }

  // Show loading spinner
  const loadingSpinner = document.getElementById("comparisonLoading");
  const comparisonContent = document.getElementById("comparisonContent");
  
  loadingSpinner.classList.remove("d-none");
  comparisonContent.innerHTML = "";

  // Create an array of promises for fetching ratings for each country
  const promises = selectedCountries.map(country => {
    return fetch(`/api/credit-ratings?country=${encodeURIComponent(country)}`)
      .then(res => {
        if (!res.ok) {
          console.error(`Error fetching data for ${country}: ${res.status}`);
          return { country, ratings: {} };
        }
        return res.json().then(data => {
          return { country, ratings: data };
        });
      })
      .catch(error => {
        console.error(`Error fetching data for ${country}:`, error);
        return { country, ratings: {} };
      });
  });

  // Wait for all promises to resolve
  Promise.all(promises)
    .then(countriesData => {
      // Hide loading spinner
      loadingSpinner.classList.add("d-none");
      
      // Render comparison
      renderComparison(countriesData, comparisonContent);
    })
    .catch(error => {
      console.error("Error comparing countries:", error);
      loadingSpinner.classList.add("d-none");
      comparisonContent.innerHTML = `
        <div class="alert alert-danger">
          Error comparing countries. Please try again.
        </div>
      `;
    });
}

/**
 * Render the comparison between countries
 */
function renderComparison(countriesData, container) {
  // Check if we have data
  if (!countriesData || countriesData.length === 0) {
    container.innerHTML = `
      <div class="alert alert-warning">
        No data available for comparison.
      </div>
    `;
    return;
  }

  // Create container for country cards
  const comparisonContainer = document.createElement("div");
  comparisonContainer.className = "comparison-cards";

  // Get all unique agencies across all countries
  const agencies = new Set();
  countriesData.forEach(data => {
    Object.keys(data.ratings).forEach(agency => {
      agencies.add(agency);
    });
  });

  // Create cards for each country
  countriesData.forEach(data => {
    const countryCard = createCountryCard(data, agencies);
    comparisonContainer.appendChild(countryCard);
  });

  // Add comparison analysis
  const analysisSection = createAnalysisSection(countriesData);
  
  container.appendChild(comparisonContainer);
  container.appendChild(analysisSection);
}

/**
 * Create a card for a country's ratings
 */
function createCountryCard(data, agencies) {
  const countryCard = document.createElement("div");
  countryCard.className = "country-card";

  // Country header
  const countryHeader = document.createElement("div");
  countryHeader.className = "country-card-header";
  countryHeader.innerHTML = `<h3>${data.country}</h3>`;
  countryCard.appendChild(countryHeader);

  // Ratings content
  const ratingsContent = document.createElement("div");
  ratingsContent.className = "country-card-content";

  // Add ratings for each agency
  Array.from(agencies).forEach(agency => {
    const agencyRatings = data.ratings[agency];
    
    if (agencyRatings && agencyRatings.length > 0) {
      const rating = agencyRatings[0];
      
      const ratingItem = document.createElement("div");
      ratingItem.className = "rating-item";
      
      ratingItem.innerHTML = `
        <div class="agency-name">${agency}</div>
        <div class="rating-value">${rating.Rating}</div>
        <div class="rating-outlook">Outlook: ${rating.Outlook || "N/A"}</div>
        <div class="rating-date">Updated: ${formatDate(rating.Date)}</div>
      `;
      
      ratingsContent.appendChild(ratingItem);
    }
  });

  // Calculate average TE rating
  const { avgRating } = calculateAverageRating(data);
  
  // Add summary section
  const summarySection = document.createElement("div");
  summarySection.className = "country-summary";
  
  summarySection.innerHTML = `
    <div class="summary-score">
      <div class="score-label">Credit Score</div>
      <div class="score-value">${avgRating.toFixed(1)}/100</div>
    </div>
    <div class="summary-text">
      ${getSummaryText(data.country, avgRating)}
    </div>
  `;
  
  countryCard.appendChild(ratingsContent);
  countryCard.appendChild(summarySection);
  
  return countryCard;
}

/**
 * Calculate the average rating for a country
 */
function calculateAverageRating(data) {
  let totalRating = 0;
  let ratingCount = 0;
  
  Object.keys(data.ratings).forEach(agency => {
    if (data.ratings[agency] && data.ratings[agency].length > 0) {
      const rating = data.ratings[agency][0];
      if (rating["TE-Rating"]) {
        totalRating += rating["TE-Rating"];
        ratingCount++;
      }
    }
  });
  
  const avgRating = ratingCount > 0 ? totalRating / ratingCount : 0;
  
  return {
    totalRating,
    ratingCount,
    avgRating
  };
}

/**
 * Create the analysis section comparing countries
 */
function createAnalysisSection(countriesData) {
  const analysisSection = document.createElement("div");
  analysisSection.className = "comparison-analysis";
  
  // Calculate ratings for analysis
  const ratingSummary = countriesData.map(data => {
    const { avgRating } = calculateAverageRating(data);
    
    return {
      country: data.country,
      avgRating: avgRating
    };
  });
  
  // Sort by average rating (highest first)
  ratingSummary.sort((a, b) => b.avgRating - a.avgRating);
  
  analysisSection.innerHTML = `
    <h4>Comparison Analysis</h4>
    <p>${getAnalysisSummary(ratingSummary)}</p>
  `;
  
  return analysisSection;
}

/**
 * Get summary text for a country based on its score
 */
function getSummaryText(country, score) {
  if (score >= 90) {
    return `${country} has excellent creditworthiness with minimal risk.`;
  } else if (score >= 80) {
    return `${country} has very strong creditworthiness with low risk.`;
  } else if (score >= 70) {
    return `${country} has strong creditworthiness with moderate risk.`;
  } else if (score >= 60) {
    return `${country} has good creditworthiness with manageable risk.`;
  } else if (score >= 50) {
    return `${country} has moderate creditworthiness with some risk concerns.`;
  } else if (score >= 40) {
    return `${country} has speculative creditworthiness with substantial risk.`;
  } else if (score >= 30) {
    return `${country} has highly speculative creditworthiness with high risk.`;
  } else {
    return `${country} has significant credit risk concerns.`;
  }
}

/**
 * Get analysis summary text comparing countries
 */
function getAnalysisSummary(ratingSummary) {
  if (ratingSummary.length === 0) return "No data available for analysis.";

  const highestRated = ratingSummary[0];
  const lowestRated = ratingSummary[ratingSummary.length - 1];

  let analysis = `<strong>${
    highestRated.country
  }</strong> has the higher average credit rating at ${highestRated.avgRating.toFixed(
    1
  )}/100`;

  if (ratingSummary.length > 1) {
    analysis += `, while <strong>${
      lowestRated.country
    }</strong> has the lower at ${lowestRated.avgRating.toFixed(1)}/100.`;
  } else {
    analysis += ".";
  }

  // Add more analysis based on rating differences
  if (ratingSummary.length > 1) {
    const ratingDiff = highestRated.avgRating - lowestRated.avgRating;

    if (ratingDiff > 30) {
      analysis += ` There is a significant difference (${ratingDiff.toFixed(
        1
      )} points) between the two countries.`;
    } else if (ratingDiff > 10) {
      analysis += ` There is a moderate difference (${ratingDiff.toFixed(
        1
      )} points) between the two countries.`;
    } else {
      analysis += ` There is a small difference (${ratingDiff.toFixed(
        1
      )} points) between the two countries.`;
    }
  }

  return analysis;
}

/**
 * Format a date string to a localized date
 */
function formatDate(dateStr) {
  if (!dateStr) return "N/A";

  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  } catch (e) {
    return dateStr;
  }
}
