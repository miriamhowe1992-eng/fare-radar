const state = {
  flights: [],
  currentResults: [],
  searchParams: null,
};

const elements = {
  dealList: document.getElementById("deal-list"),
  searchForm: document.getElementById("search-form"),
  resultsList: document.getElementById("results-list"),
  resultsSection: document.getElementById("results"),
  emptyState: document.querySelector(".empty-state"),
  airlineFilter: document.getElementById("airline-filter"),
  stopsFilter: document.getElementById("stops-filter"),
  sortOrder: document.getElementById("sort-order"),
};

async function loadFlights() {
  try {
    const response = await fetch("./data/flights.json");
    if (!response.ok) {
      throw new Error(`Failed to load flights: ${response.status}`);
    }
    const flights = await response.json();
    state.flights = flights;
    populateDeals(flights);
    populateAirlineFilter(flights);
  } catch (error) {
    console.error(error);
    elements.dealList.innerHTML = `<li class="error">Unable to load sample fares right now.</li>`;
  }
}

function populateDeals(flights) {
  const deals = [...flights]
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);

  elements.dealList.innerHTML = deals
    .map((deal) => {
      const route = `${deal.origin} → ${deal.destination}`;
      const formattedPrice = formatCurrency(deal.price, deal.currency);
      return `<li class="deal-card">
          <div>
            <strong>${route}</strong>
            <p class="result-meta">${deal.airline} &bull; ${formatDuration(
        deal.durationMinutes
      )}</p>
          </div>
          <span class="price">${formattedPrice}</span>
        </li>`;
    })
    .join("");
}

function populateAirlineFilter(flights) {
  const uniqueAirlines = Array.from(new Set(flights.map((flight) => flight.airline)));
  elements.airlineFilter.innerHTML = [
    `<option value="all">All airlines</option>`,
    ...uniqueAirlines.map((airline) => `<option value="${airline}">${airline}</option>`),
  ].join("");
}

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDuration(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

function handleSearch(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const origin = formData.get("origin")?.trim().toUpperCase();
  const destination = formData.get("destination")?.trim().toUpperCase();
  const departDate = formData.get("depart");
  const returnDate = formData.get("return");

  if (!origin || !destination) {
    return;
  }

  const matchingFlights = state.flights.filter((flight) => {
    if (flight.origin !== origin || flight.destination !== destination) {
      return false;
    }
    if (departDate) {
      const flightDate = flight.depart.split("T")[0];
      if (flightDate !== departDate) {
        return false;
      }
    }
    if (returnDate) {
      // Sample data is one-way; placeholder to show round-trip logic in future
    }
    return true;
  });

  state.searchParams = { origin, destination, departDate, returnDate };
  state.currentResults = matchingFlights;
  applyFilters();
}

function applyFilters() {
  let results = [...state.currentResults];
  const airline = elements.airlineFilter.value;
  const stops = elements.stopsFilter.value;
  const sort = elements.sortOrder.value;

  if (airline && airline !== "all") {
    results = results.filter((flight) => flight.airline === airline);
  }

  if (stops && stops !== "all") {
    const stopCount = Number(stops);
    if (stopCount === 2) {
      results = results.filter((flight) => flight.stops >= 2);
    } else {
      results = results.filter((flight) => flight.stops === stopCount);
    }
  }

  results.sort((a, b) => {
    switch (sort) {
      case "duration":
        return a.durationMinutes - b.durationMinutes;
      case "takeoff":
        return new Date(a.depart) - new Date(b.depart);
      case "price":
      default:
        return a.price - b.price;
    }
  });

  renderResults(results);
}

function renderResults(results) {
  if (!state.searchParams) {
    return;
  }

  if (!results.length) {
    elements.emptyState.textContent =
      "No fares found for that route yet. Try adjusting your filters.";
    elements.emptyState.hidden = false;
    elements.resultsList.innerHTML = "";
    return;
  }

  elements.emptyState.hidden = true;
  const { origin, destination } = state.searchParams;

  elements.resultsList.innerHTML = results
    .map((flight) => {
      const price = formatCurrency(flight.price, flight.currency);
      const depart = formatTime(flight.depart);
      const arrive = formatTime(flight.arrive);
      const stopsLabel = flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${
        flight.stops > 1 ? "s" : ""
      }`;
      return `<li class="result-card">
          <div class="result-summary">
            <span class="tag">${flight.airline}</span>
            <h4>${origin} &rarr; ${destination}</h4>
            <p class="result-meta">${depart} &ndash; ${arrive} &bull; ${stopsLabel}</p>
            <p class="result-meta">Operated by ${flight.partner}</p>
          </div>
          <div>
            <div class="price">${price}</div>
            <p class="result-meta">${formatDuration(flight.durationMinutes)} total</p>
          </div>
          <div class="result-actions">
            <button class="primary" type="button" data-flight="${flight.id}">Book now</button>
            <button class="secondary" type="button" data-flight="${flight.id}" data-action="share">Share</button>
          </div>
        </li>`;
    })
    .join("");
}

function handleResultsClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const flightId = button.dataset.flight;
  const flight = state.flights.find((item) => item.id === flightId);
  if (!flight) return;

  if (button.dataset.action === "share") {
    navigator.clipboard
      ?.writeText(
        `Check out this fare from ${flight.origin} to ${flight.destination} for ${formatCurrency(
          flight.price,
          flight.currency
        )} on FareRadar!`
      )
      .then(() => {
        button.textContent = "Copied!";
        setTimeout(() => (button.textContent = "Share"), 2000);
      })
      .catch(() => alert("Copied fare details. Share it with your friends!"));
    return;
  }

  const message = `Start booking ${flight.origin} → ${flight.destination} with ${flight.partner}.\nOur partners complete the reservation and share commission automatically.`;
  alert(message);
}

function initEventListeners() {
  elements.searchForm.addEventListener("submit", handleSearch);
  elements.airlineFilter.addEventListener("change", applyFilters);
  elements.stopsFilter.addEventListener("change", applyFilters);
  elements.sortOrder.addEventListener("change", applyFilters);
  elements.resultsList.addEventListener("click", handleResultsClick);
}

function setFooterYear() {
  const year = new Date().getFullYear();
  document.getElementById("copyright-year").textContent = year;
}

setFooterYear();
initEventListeners();
loadFlights();
