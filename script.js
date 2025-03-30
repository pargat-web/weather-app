// ---------------- API CONFIGURATION ----------------
// OpenWeatherMap API Key
const API_KEY = '329c0c05a7d8cf6516f6257cd6291ad4'; // My API key
const API_BASE_URL = 'https://api.openweathermap.org/data/2.5'; // Base URL for weather data
const GEO_API_URL = 'https://api.openweathermap.org/geo/1.0'; // URL for geocoding (converting city names to coordinates)

// ---------------- DOM ELEMENTS ----------------
// Getting all the HTML elements we need to work with
const elements = {
    cityInput: document.getElementById('cityInput'),
    searchButton: document.getElementById('searchButton'),
    inputError: document.getElementById('inputError'),
    loader: document.getElementById('loader'),
    weatherData: document.getElementById('weatherData'),
    apiError: document.getElementById('apiError'),
    cityName: document.getElementById('cityName'),
    weatherIcon: document.getElementById('weatherIcon'),
    temperature: document.getElementById('temperature').querySelector('span'),
    weatherDescription: document.getElementById('weatherDescription').querySelector('span'),
    humidity: document.getElementById('humidity').querySelector('span'),
    windSpeed: document.getElementById('windSpeed').querySelector('span'),
    forecast: document.getElementById('forecast'),
    addToFavorites: document.getElementById('addToFavorites'),
    favoritesList: document.getElementById('favoritesList'),

    // Settings dialog elements
    settingsButton: document.getElementById('settingsButton'),
    customizeDialog: document.getElementById('customizeDialog'),
    closeDialog: document.getElementById('closeDialog'),
    primaryColor: document.getElementById('primaryColor'),
    accentColor: document.getElementById('accentColor'),
    backgroundColor: document.getElementById('backgroundColor'),
    fontSize: document.getElementById('fontSize'),
    fontSizeValue: document.getElementById('fontSizeValue'),
    borderRadius: document.getElementById('borderRadius'),
    borderRadiusValue: document.getElementById('borderRadiusValue'),
    resetDefaults: document.getElementById('resetDefaults')
};

// ---------------- GLOBAL VARIABLES ----------------
// Variables to keep track of application state
let lastSearchedCity = ''; // Store the last city searched
let selectedCityData = null; // Store data from autocomplete selection

// Default CSS variable values for reset
const defaultStyles = {
    primaryColor: '#1e88e5',
    secondaryColor: '#64b5f6',
    backgroundColor: '#0a1929',
    accentColor: '#ff9800',
    fontSize: '16px',
    borderRadius: '12px'
};

// ---------------- INITIALIZATION ----------------
// Set up the application when the page loads
$(document).ready(function () {
    // Load saved favorite cities
    loadFavorites();
    loadCustomStyles(); // Load saved custom styles

    // Set up autocomplete for the city input field
    $("#cityInput").autocomplete({
        // This function gets called when user types in the input
        source: function (request, response) {
            const term = request.term.trim();
            if (term.length < 2) return; // Don't search for very short terms

            // Show loading indicator in input field
            $("#cityInput").addClass("loading");

            // Call the OpenWeatherMap API to get city suggestions
            const geoApiUrl = `${GEO_API_URL}/direct?q=${term}&limit=10&appid=${API_KEY}`;

            fetch(geoApiUrl)
                .then(res => res.json())
                .then(data => {
                    // Remove loading indicator
                    $("#cityInput").removeClass("loading");

                    if (data && data.length > 0) {
                        // Format city data for the autocomplete dropdown
                        console.log(data)
                        const cities = data.map(city => {
                            const stateInfo = city.state ? `, ${city.state}` : '';
                            return {
                                label: `${city.name}${stateInfo}, ${city.country}`,
                                value: `${city.name}${stateInfo}, ${city.country}`,
                                cityData: city // Store full city data
                            };
                        });
                        response(cities); // Pass cities to autocomplete
                    } else {
                        response([]); // No results found
                    }
                })
                .catch(err => {
                    console.error("Error fetching city suggestions:", err);
                    // Remove loading indicator
                    $("#cityInput").removeClass("loading");
                    response([]);
                });
        },
        minLength: 2, // Minimum characters before searching
        // When user selects a city from dropdown
        select: function (event, ui) {
            // Store the selected city data
            selectedCityData = ui.item.cityData;

            // Trigger search after a short delay
            setTimeout(() => {
                handleSearch();
            }, 100);
        },
        close: function () {
            // Remove loading indicator when dropdown closes
            $("#cityInput").removeClass("loading");
        }
    }).autocomplete("instance")._renderItem = function (ul, item) {
        // Custom styling for autocomplete dropdown items
        return $("<li>")
            .append(`<div class='autocomplete-item'>
                <i class='wi wi-day-sunny'></i>
                <div class='city-info'>
                    <div class='city-name'>${item.label}</div>
                </div>
            </div>`)
            .appendTo(ul);
    };

    // Initialize CSS customization dialog
    initializeCustomizationDialog();
});

// ---------------- EVENT LISTENERS ----------------
// Set up actions for user interactions
elements.searchButton.addEventListener('click', handleSearch); // Search when button is clicked
elements.cityInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') { // Search when Enter key is pressed
        handleSearch();
    }
});
elements.addToFavorites.addEventListener('click', addCurrentCityToFavorites); // Add current city to favorites when button is clicked

// ---------------- INPUT VALIDATION ----------------
// Make sure city name input is valid
function validateCity(city) {
    const cityRegex = /^[a-zA-Z\s,-]+$/; // Only letters, spaces, commas, and hyphens allowed
    return cityRegex.test(city);
}

// ---------------- SEARCH HANDLING ----------------
// Process the search when user submits a city name
function handleSearch() {
    const city = elements.cityInput.value.trim();

    // Clear any previous error messages
    elements.inputError.style.display = 'none';
    elements.apiError.style.display = 'none';

    // Validate city input
    if (!city) {
        showInputError('Please enter a city name'); // Show error if input is empty
        return;
    }

    if (!validateCity(city)) {
        showInputError('City name should contain only letters'); // Show error if input has invalid characters
        return;
    }

    // Store the city name for favorites
    lastSearchedCity = city;

    // Show loading animation
    $(elements.loader).fadeIn(300);
    $(elements.weatherData).fadeOut(300);

    // If we have detailed city data from autocomplete, use coordinates (more accurate)
    if (selectedCityData &&
        city === `${selectedCityData.name}${selectedCityData.state ? `, ${selectedCityData.state}` : ''}, ${selectedCityData.country}`) {
        fetchWeatherByCoordinates(selectedCityData.lat, selectedCityData.lon);
    } else {
        // Otherwise search by city name
        fetchWeatherData(city);
        selectedCityData = null; // Reset selected city
    }
}

// Display input validation error message
function showInputError(message) {
    elements.inputError.textContent = message;
    $(elements.inputError).hide().fadeIn(300); // Fade in animation
}

// ---------------- API REQUESTS ----------------
// Fetch weather data using geographic coordinates
function fetchWeatherByCoordinates(lat, lon) {
    // URL for current weather data
    const currentWeatherURL = `${API_BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;

    // Fetch current weather
    fetch(currentWeatherURL)
        .then(response => {
            if (!response.ok) {
                throw new Error('City not found');
            }
            return response.json();
        })
        .then(data => {
            // Store city ID for favorites if available
            if (selectedCityData) {
                selectedCityData.id = data.id;
            }

            // Now get the 5-day forecast data
            const forecastURL = `${API_BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
            return fetch(forecastURL)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to fetch forecast data');
                    }
                    return response.json();
                })
                .then(forecastData => {
                    // Display the weather information
                    displayWeatherData(data, forecastData);
                });
        })
        .catch(error => {
            console.error('Error fetching weather data:', error);
            showApiError(error.message);
        })
        .finally(() => {
            // Hide loader when done (success or failure)
            $(elements.loader).fadeOut(300);
        });
}

// Fetch weather data using city name
function fetchWeatherData(city) {
    // URL for current weather data
    const currentWeatherURL = `${API_BASE_URL}/weather?q=${city}&units=metric&appid=${API_KEY}`;

    // Fetch current weather
    fetch(currentWeatherURL)
        .then(response => {
            if (!response.ok) {
                throw new Error('City not found');
            }
            return response.json();
        })
        .then(data => {
            // Now get the 5-day forecast data
            const forecastURL = `${API_BASE_URL}/forecast?q=${city}&units=metric&appid=${API_KEY}`;
            return fetch(forecastURL)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to fetch forecast data');
                    }
                    return response.json();
                })
                .then(forecastData => {
                    // Display the weather information
                    displayWeatherData(data, forecastData);
                });
        })
        .catch(error => {
            console.error('Error fetching weather data:', error);
            showApiError(error.message);
        })
        .finally(() => {
            // Hide loader when done (success or failure)
            $(elements.loader).fadeOut(300);
        });
}

// ---------------- DISPLAY WEATHER DATA ----------------
// Show all weather information on the page
function displayWeatherData(currentData, forecastData) {
    console.log('Current Weather Data:', currentData); // For debugging

    // Display city name and country
    elements.cityName.textContent = `${currentData.name}, ${currentData.sys.country}`;

    // Display weather icon
    const iconCode = currentData.weather[0].icon;
    elements.weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

    try {
        // Set weather theme and animations based on weather code
        setWeatherEffects(iconCode);
    } catch (error) {
        console.error("Error applying weather effects:", error);
        // Apply a default styling to ensure UI isn't broken
        document.body.classList.add('weather-clear-day');
    }

    // ---------------- Display main weather details ----------------
    // Temperature
    elements.temperature.textContent = `${Math.round(currentData.main.temp)}°C`;
    document.getElementById('feelsLike').querySelector('span').textContent = `${Math.round(currentData.main.feels_like)}°C`;
    // Weather description (e.g. "broken clouds")
    elements.weatherDescription.textContent = `${currentData.weather[0].description}`;
    // Humidity percentage
    elements.humidity.textContent = `${currentData.main.humidity}%`;
    // Wind speed (convert from m/s to km/h)
    elements.windSpeed.textContent = `${Math.round(currentData.wind.speed * 3.6)} km/h`;

    // ---------------- Display additional details ----------------
    // Atmospheric pressure
    document.getElementById('pressure').querySelector('span').textContent = `${currentData.main.pressure} hPa`;

    // Visibility (convert from meters to km)
    const visibilityKm = currentData.visibility / 1000;
    document.getElementById('visibility').querySelector('span').textContent = `${visibilityKm.toFixed(1)} km`;

    // Sunrise and sunset times
    const sunriseTime = new Date(currentData.sys.sunrise * 1000); // Convert to milliseconds
    const sunsetTime = new Date(currentData.sys.sunset * 1000);

    // Format as HH:MM
    document.getElementById('sunrise').querySelector('span').textContent =
        `${sunriseTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    document.getElementById('sunset').querySelector('span').textContent =
        `${sunsetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    // Temperature range
    document.getElementById('tempMin').querySelector('span').textContent = `${Math.round(currentData.main.temp_min)}°C`;
    document.getElementById('tempMax').querySelector('span').textContent = `${Math.round(currentData.main.temp_max)}°C`;

    // Wind direction
    const windDegrees = currentData.wind.deg;
    // Convert degrees to cardinal direction (N, NE, E, etc.)
    const windDirections = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const windDirectionIndex = Math.round(windDegrees / 45) % 8;
    document.getElementById('windDirection').querySelector('span').textContent =
        `${windDirections[windDirectionIndex]} (${windDegrees}°)`;

    // Wind gusts (if available)
    const windGustElement = document.getElementById('windGust').querySelector('span');
    if (currentData.wind.gust) {
        windGustElement.textContent = `${Math.round(currentData.wind.gust * 3.6)} km/h`;
    } else {
        windGustElement.textContent = 'N/A'; // Not available
    }

    // Cloud coverage percentage
    document.getElementById('clouds').querySelector('span').textContent = `${currentData.clouds.all}%`;

    // Geographic coordinates
    document.getElementById('coordinates').querySelector('span').textContent =
        `Lat: ${currentData.coord.lat.toFixed(2)}, Lon: ${currentData.coord.lon.toFixed(2)}`;

    // Display 5-day forecast
    displayForecast(forecastData);

    // Show all weather data with fade-in animation
    elements.weatherData.style.display = 'block';
    $(elements.weatherData).hide().fadeIn(800);
    $(elements.weatherData).addClass('show');
}

// ===== DISPLAY FORECAST =====
function displayForecast(forecastData) {
    console.log('Forecast Data:', forecastData);

    elements.forecast.innerHTML = '';

    // Get one forecast per day (around noon)
    const dailyForecasts = {};
    forecastData.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });

        if (!dailyForecasts[day] && date.getHours() >= 11 && date.getHours() <= 14) {
            dailyForecasts[day] = item;
        }
    });

    // Get first 5 days of forecast
    const forecasts = Object.values(dailyForecasts).slice(0, 5);

    // Create a card for each day
    forecasts.forEach((item, index) => {
        const date = new Date(item.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const fullDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const iconCode = item.weather[0].icon;

        const forecastDay = document.createElement('div');
        forecastDay.className = 'forecast-day';

        forecastDay.innerHTML = `
            <h4>${day}</h4>
            <p class="forecast-date">${fullDate}</p>
            <img src="https://openweathermap.org/img/wn/${iconCode}.png" alt="${item.weather[0].description}">
            <p class="temp">${Math.round(item.main.temp)}°C</p>
            <p class="forecast-description">${item.weather[0].description}</p>
            <div class="forecast-details">
                <p><i class="wi wi-thermometer-exterior"></i> ${Math.round(item.main.temp_min)}°C / ${Math.round(item.main.temp_max)}°C</p>
                <p><i class="wi wi-humidity"></i> ${item.main.humidity}%</p>
                <p><i class="wi wi-strong-wind"></i> ${Math.round(item.wind.speed * 3.6)} km/h</p>
                <p><i class="wi wi-barometer"></i> ${item.main.pressure} hPa</p>
            </div>
        `;

        elements.forecast.appendChild(forecastDay);

        // Staggered animation
        setTimeout(() => {
            forecastDay.classList.add('show');
        }, 150 * index);
    });
}

// ---------------- ERROR HANDLING ----------------
// Display API error message
function showApiError(message) {
    elements.apiError.textContent = `Error: ${message}. Please try again.`;
    $(elements.apiError).hide().fadeIn(300); // Fade in animation
}

// ---------------- FAVORITES FUNCTIONALITY ----------------
// Add current city to favorites
function addCurrentCityToFavorites() {
    // Prepare city data to save
    let cityToAdd = {};

    if (selectedCityData && selectedCityData.id) {
        // Use detailed data if available (from autocomplete)
        cityToAdd = {
            name: lastSearchedCity,
            id: selectedCityData.id,
            lat: selectedCityData.lat,
            lon: selectedCityData.lon
        };
    } else {
        // Just use the name if no detailed data
        cityToAdd = {
            name: lastSearchedCity
        };
    }

    // Check if we have a city to add
    if (!cityToAdd.name) {
        return; // No city currently searched
    }

    // Get existing favorites from storage
    const favorites = getFavorites();

    // Check if city is already in favorites
    const cityExists = favorites.some(fav =>
        (fav.name && fav.name.toLowerCase() === cityToAdd.name.toLowerCase()) ||
        (fav.id && cityToAdd.id && fav.id === cityToAdd.id)
    );

    if (!cityExists) {
        // Add new favorite to the beginning of the list
        favorites.unshift(cityToAdd);
        saveFavorites(favorites);

        // Update the favorites list
        loadFavorites();

        // Highlight the newly added favorite
        setTimeout(() => {
            const firstFavorite = document.querySelector('.favorite-item');
            if (firstFavorite) {
                // Scroll to make new favorite visible
                const sidebar = document.querySelector('.favorites-sidebar');
                sidebar.scrollTop = 0;

                // Add highlight animation
                firstFavorite.classList.add('highlight');

                // Remove highlight after animation completes
                setTimeout(() => {
                    firstFavorite.classList.remove('highlight');
                }, 2000);
            }
        }, 300);
    } else {
        // City is already in favorites
        // Shake button to indicate it's already added
        $(elements.addToFavorites).effect('shake', { times: 3, distance: 5 }, 300);

        // Find and highlight the existing favorite
        const existingFavoriteIndex = favorites.findIndex(fav =>
            (fav.name && fav.name.toLowerCase() === cityToAdd.name.toLowerCase()) ||
            (fav.id && cityToAdd.id && fav.id === cityToAdd.id)
        );

        if (existingFavoriteIndex !== -1) {
            setTimeout(() => {
                const favoriteItems = document.querySelectorAll('.favorite-item');
                if (favoriteItems[existingFavoriteIndex]) {
                    // Scroll to the existing favorite
                    favoriteItems[existingFavoriteIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Highlight it
                    favoriteItems[existingFavoriteIndex].classList.add('highlight');

                    // Remove highlight after animation
                    setTimeout(() => {
                        favoriteItems[existingFavoriteIndex].classList.remove('highlight');
                    }, 2000);
                }
            }, 300);
        }
    }
}

// ---------------- LOCAL STORAGE FUNCTIONS ----------------
// Save favorites to browser storage
function saveFavorites(favorites) {
    localStorage.setItem('weatherAppFavorites', JSON.stringify(favorites));
}

// Get favorites from browser storage
function getFavorites() {
    const savedFavorites = localStorage.getItem('weatherAppFavorites');
    return savedFavorites ? JSON.parse(savedFavorites) : []; // Return empty array if none
}

// ---------------- FAVORITES DISPLAY ----------------
// Load and display favorite cities
function loadFavorites() {
    const favorites = getFavorites();

    // Clear favorites list
    elements.favoritesList.innerHTML = '';

    if (favorites.length === 0) {
        // Show message if no favorites
        elements.favoritesList.innerHTML = '<p>No favorites added yet</p>';
        return;
    }

    // Create an element for each favorite city
    favorites.forEach((favorite, index) => {
        const favoriteItem = document.createElement('div');
        favoriteItem.className = 'favorite-item';

        // City name element
        const cityNameSpan = document.createElement('span');
        cityNameSpan.textContent = favorite.name;
        cityNameSpan.className = 'favorite-city-name';

        // Remove button
        const removeButton = document.createElement('span');
        removeButton.innerHTML = '&times;'; // × symbol
        removeButton.className = 'remove-favorite';
        removeButton.title = 'Remove from favorites';

        // Add elements to favorite item
        favoriteItem.appendChild(cityNameSpan);
        favoriteItem.appendChild(removeButton);

        // Initial state for animation
        favoriteItem.style.opacity = '0';
        favoriteItem.style.transform = 'translateY(10px)';

        // Add click event to search for this city
        cityNameSpan.addEventListener('click', function () {
            // Set the input field to the city name
            elements.cityInput.value = favorite.name;

            // Choose the best search method based on available data
            if (favorite.lat && favorite.lon) {
                // Use coordinates (most accurate)
                selectedCityData = {
                    lat: favorite.lat,
                    lon: favorite.lon,
                    name: favorite.name.split(',')[0], // Extract just the city name
                    id: favorite.id
                };
                fetchWeatherByCoordinates(favorite.lat, favorite.lon);
            } else if (favorite.id) {
                // Use city ID if available
                fetchWeatherById(favorite.id);
            } else {
                // Use city name as fallback
                fetchWeatherData(favorite.name);
            }

            // Bounce animation for selected item
            $(favoriteItem).effect('bounce', { times: 1, distance: 10 }, 300);

            // Show loading spinner
            $(elements.loader).fadeIn(300);
            $(elements.weatherData).fadeOut(300);
        });

        // Add click event to remove button
        removeButton.addEventListener('click', function (e) {
            e.stopPropagation(); // Prevent triggering parent click events
            removeFavoriteCity(favorite, favoriteItem);
        });

        // Add to favorites list
        elements.favoritesList.appendChild(favoriteItem);

        // Animate in with staggered delay
        setTimeout(() => {
            favoriteItem.style.opacity = '1';
            favoriteItem.style.transform = 'translateY(0)';
            favoriteItem.style.transition = 'all 0.3s ease';
        }, 100 * index); // Delay increases for each item
    });
}

// ---------------- ADDITIONAL API FETCH METHODS ----------------
// Fetch weather using city ID (most reliable method)
function fetchWeatherById(cityId) {
    // URL for current weather
    const currentWeatherURL = `${API_BASE_URL}/weather?id=${cityId}&units=metric&appid=${API_KEY}`;

    // Fetch current weather
    fetch(currentWeatherURL)
        .then(response => {
            if (!response.ok) {
                throw new Error('City not found');
            }
            return response.json();
        })
        .then(data => {
            // Fetch 5-day forecast
            const forecastURL = `${API_BASE_URL}/forecast?id=${cityId}&units=metric&appid=${API_KEY}`;
            return fetch(forecastURL)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to fetch forecast data');
                    }
                    return response.json();
                })
                .then(forecastData => {
                    // Display the weather information
                    displayWeatherData(data, forecastData);
                });
        })
        .catch(error => {
            console.error('Error fetching weather data:', error);
            showApiError(error.message);

            // Fallback to fetching by name if ID fails
            const cityName = getFavorites().find(f => f.id === cityId)?.name;
            if (cityName) {
                fetchWeatherData(cityName);
            }
        })
        .finally(() => {
            // Hide loader when done
            $(elements.loader).fadeOut(300);
        });
}

// ---------------- REMOVE FAVORITE ----------------
// Remove a city from favorites
function removeFavoriteCity(cityToRemove, itemElement) {
    // Get current favorites
    let favorites = getFavorites();

    // Remove the city from the list
    favorites = favorites.filter(city => {
        if (cityToRemove.id) {
            return city.id !== cityToRemove.id; // Compare by ID if available
        } else {
            return city.name !== cityToRemove.name; // Otherwise compare by name
        }
    });

    // Animate the removal
    $(itemElement).effect('fade', 300, function () {
        // Save updated favorites
        saveFavorites(favorites);

        // Refresh the favorites list
        loadFavorites();
    });
}

// ===== CSS CUSTOMIZATION =====
function initializeCustomizationDialog() {
    // Open dialog when settings button is clicked
    elements.settingsButton.addEventListener('click', function () {
        elements.customizeDialog.classList.add('show');
    });

    // Close dialog when close button is clicked
    elements.closeDialog.addEventListener('click', function () {
        elements.customizeDialog.classList.remove('show');
    });

    // Close dialog when clicking outside content area
    elements.customizeDialog.addEventListener('click', function (e) {
        if (e.target === elements.customizeDialog) {
            elements.customizeDialog.classList.remove('show');
        }
    });

    // Update CSS variables when color inputs change
    elements.primaryColor.addEventListener('input', function () {
        document.documentElement.style.setProperty('--primary-color', this.value);
        // Update secondary color as a lighter version of primary
        const secondaryColor = lightenColor(this.value, 20);
        document.documentElement.style.setProperty('--secondary-color', secondaryColor);
        saveCustomStyles();
    });

    elements.accentColor.addEventListener('input', function () {
        document.documentElement.style.setProperty('--accent-color', this.value);
        saveCustomStyles();
    });

    elements.backgroundColor.addEventListener('input', function () {
        document.documentElement.style.setProperty('--background-color', this.value);
        saveCustomStyles();
    });

    // Update CSS variables when range inputs change
    elements.fontSize.addEventListener('input', function () {
        const value = this.value + 'px';
        document.documentElement.style.setProperty('--font-size', value);
        elements.fontSizeValue.textContent = value;
        saveCustomStyles();
    });

    elements.borderRadius.addEventListener('input', function () {
        const value = this.value + 'px';
        document.documentElement.style.setProperty('--border-radius', value);
        elements.borderRadiusValue.textContent = value;
        saveCustomStyles();
    });

    // Reset to default styles
    elements.resetDefaults.addEventListener('click', resetToDefaultStyles);
}

// Load custom styles from localStorage
function loadCustomStyles() {
    const savedStyles = localStorage.getItem('weatherAppStyles');
    if (savedStyles) {
        const styles = JSON.parse(savedStyles);

        // Apply saved styles to CSS variables
        document.documentElement.style.setProperty('--primary-color', styles.primaryColor);
        document.documentElement.style.setProperty('--secondary-color', styles.secondaryColor);
        document.documentElement.style.setProperty('--background-color', styles.backgroundColor);
        document.documentElement.style.setProperty('--accent-color', styles.accentColor);
        document.documentElement.style.setProperty('--font-size', styles.fontSize);
        document.documentElement.style.setProperty('--border-radius', styles.borderRadius);

        // Update input elements to match saved values
        elements.primaryColor.value = styles.primaryColor;
        elements.accentColor.value = styles.accentColor;
        elements.backgroundColor.value = styles.backgroundColor;

        const fontSizeValue = parseInt(styles.fontSize);
        elements.fontSize.value = fontSizeValue;
        elements.fontSizeValue.textContent = styles.fontSize;

        const borderRadiusValue = parseInt(styles.borderRadius);
        elements.borderRadius.value = borderRadiusValue;
        elements.borderRadiusValue.textContent = styles.borderRadius;
    }
}

// Save custom styles to localStorage
function saveCustomStyles() {
    const styles = {
        primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim(),
        secondaryColor: getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim(),
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim(),
        accentColor: getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim(),
        fontSize: getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim(),
        borderRadius: getComputedStyle(document.documentElement).getPropertyValue('--border-radius').trim()
    };

    localStorage.setItem('weatherAppStyles', JSON.stringify(styles));
}

// Reset to default styles
function resetToDefaultStyles() {
    document.documentElement.style.setProperty('--primary-color', defaultStyles.primaryColor);
    document.documentElement.style.setProperty('--secondary-color', defaultStyles.secondaryColor);
    document.documentElement.style.setProperty('--background-color', defaultStyles.backgroundColor);
    document.documentElement.style.setProperty('--accent-color', defaultStyles.accentColor);
    document.documentElement.style.setProperty('--font-size', defaultStyles.fontSize);
    document.documentElement.style.setProperty('--border-radius', defaultStyles.borderRadius);

    // Update input elements to match default values
    elements.primaryColor.value = defaultStyles.primaryColor;
    elements.accentColor.value = defaultStyles.accentColor;
    elements.backgroundColor.value = defaultStyles.backgroundColor;

    const fontSizeValue = parseInt(defaultStyles.fontSize);
    elements.fontSize.value = fontSizeValue;
    elements.fontSizeValue.textContent = defaultStyles.fontSize;

    const borderRadiusValue = parseInt(defaultStyles.borderRadius);
    elements.borderRadius.value = borderRadiusValue;
    elements.borderRadiusValue.textContent = defaultStyles.borderRadius;

    // Save default styles
    saveCustomStyles();
}

// Helper function to lighten a color (for generating secondary color)
function lightenColor(color, percent) {
    // Convert hex to RGB
    let r = parseInt(color.substring(1, 3), 16);
    let g = parseInt(color.substring(3, 5), 16);
    let b = parseInt(color.substring(5, 7), 16);

    // Lighten
    r = Math.floor(r + (255 - r) * (percent / 100));
    g = Math.floor(g + (255 - g) * (percent / 100));
    b = Math.floor(b + (255 - b) * (percent / 100));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ==================== WEATHER EFFECTS AND ANIMATIONS ====================
// Apply weather effects based on weather code
function setWeatherEffects(weatherCode) {
    try {
        // Clear all previous weather classes from body
        document.body.classList.remove(
            'weather-clear-day',
            'weather-clear-night',
            'weather-rainy',
            'weather-snowy',
            'weather-cloudy',
            'weather-thunder',
            'weather-fog'
        );

        // Hide all weather animations
        clearAllWeatherAnimations();

        // Time of day check: d = day, n = night
        const isDayTime = weatherCode.includes('d');

        // Get the first two characters of the weather code
        // This tells us the main weather condition
        const condition = weatherCode.substring(0, 2);

        // Apply the appropriate weather effect based on the weather code
        switch (condition) {
            case '01': // Clear sky
                if (isDayTime) {
                    document.body.classList.add('weather-clear-day');
                    activateSunRays();
                } else {
                    document.body.classList.add('weather-clear-night');
                    document.querySelector('.stars').style.opacity = '0.8';
                }
                break;

            case '02': // Few clouds
            case '03': // Scattered clouds
            case '04': // Broken clouds / Overcast
                if (isDayTime) {
                    document.body.classList.add('weather-clear-day');
                    document.querySelector('.clouds').style.opacity = '0.7';
                    activateSunRays(0.3); // Dimmer sun
                } else {
                    document.body.classList.add('weather-clear-night');
                }
                break;

            case '09': // Shower rain
            case '10': // Rain
                document.body.classList.add('weather-rainy');
                createRainEffect(condition === '09' ? 'heavy' : 'light');
                break;

            case '11': // Thunderstorm
                document.body.classList.add('weather-thunder');
                createRainEffect('heavy');
                createThunderEffect();
                break;

            case '13': // Snow
                document.body.classList.add('weather-snowy');
                createSnowEffect();
                break;

            case '50': // Mist, fog, haze
                document.body.classList.add('weather-fog');
                createFogEffect();
                break;

            default:
                // Default theme based on time of day
                if (isDayTime) {
                    document.body.classList.add('weather-clear-day');
                } else {
                    document.body.classList.add('weather-clear-night');
                }
        }

        // Animate clouds based on wind speed
        document.querySelector('.clouds').style.animationDuration =
            (condition === '09' || condition === '10' || condition === '11') ? '40s' : '80s';
    } catch (error) {
        console.error("Error in setWeatherEffects:", error);
        // Apply default theme
        document.body.classList.add('weather-clear-day');
    }
}

// Clear all weather animations
function clearAllWeatherAnimations() {
    try {
        // Hide all animation containers
        document.querySelector('.rain-container').classList.remove('active');
        document.querySelector('.rain-container').innerHTML = '';

        document.querySelector('.snow-container').classList.remove('active');
        document.querySelector('.snow-container').innerHTML = '';

        document.querySelector('.fog-container').classList.remove('active');
        document.querySelector('.fog-container').innerHTML = '';

        document.querySelector('.thunder-container').classList.remove('active');
        document.querySelector('.thunder-container').innerHTML = '';

        document.querySelector('.sun-rays').classList.remove('active');

        // Reset default opacity for stars and clouds
        document.querySelector('.clouds').style.opacity = '0.5';
        document.querySelector('.stars').style.opacity = '0.3';
    } catch (error) {
        console.error("Error in clearAllWeatherAnimations:", error);
        // Gracefully fail - no need to do anything as this is just visual effects
    }
}

// Rain animation effect
function createRainEffect(intensity) {
    const rainContainer = document.querySelector('.rain-container');
    rainContainer.innerHTML = '';

    // Set number of raindrops based on intensity
    const dropCount = intensity === 'heavy' ? 200 : 100;

    for (let i = 0; i < dropCount; i++) {
        const raindrop = document.createElement('div');
        raindrop.className = 'raindrop';

        // Randomize raindrop properties
        const dropHeight = Math.random() * 20 + 10; // 10-30px height
        const dropLeft = Math.random() * 100; // 0-100% left position
        const fallDuration = Math.random() * 0.5 + 0.7; // 0.7-1.2s fall duration
        const startDelay = Math.random() * 2; // 0-2s start delay

        // Set raindrop styles
        raindrop.style.height = `${dropHeight}px`;
        raindrop.style.left = `${dropLeft}%`;
        raindrop.style.opacity = `${Math.random() * 0.4 + 0.3}`; // 0.3-0.7 opacity
        raindrop.style.animation = `rainfall ${fallDuration}s linear ${startDelay}s infinite`;

        // Add raindrop to container
        rainContainer.appendChild(raindrop);
    }

    // Add keyframes for rainfall if they don't exist
    if (!document.querySelector('#rainfall-keyframes')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'rainfall-keyframes';
        styleSheet.textContent = `
            @keyframes rainfall {
                0% { transform: translateY(-100px); }
                100% { transform: translateY(calc(100vh + 100px)); }
            }
        `;
        document.head.appendChild(styleSheet);
    }

    // Show the rain container
    rainContainer.classList.add('active');
}

// Snow animation effect
function createSnowEffect() {
    const snowContainer = document.querySelector('.snow-container');
    snowContainer.innerHTML = '';

    // Create multiple snowflakes
    for (let i = 0; i < 100; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';

        // Randomize snowflake properties
        const size = Math.random() * 5 + 3; // 3-8px
        const left = Math.random() * 100; // 0-100% left position
        const fallDuration = Math.random() * 10 + 10; // 10-20s fall duration
        const startDelay = Math.random() * 5; // 0-5s start delay

        // Set snowflake styles
        snowflake.style.width = `${size}px`;
        snowflake.style.height = `${size}px`;
        snowflake.style.left = `${left}%`;
        snowflake.style.opacity = `${Math.random() * 0.6 + 0.4}`; // 0.4-1.0 opacity
        snowflake.style.animationDuration = `${fallDuration}s`;
        snowflake.style.animationDelay = `${startDelay}s`;

        // Add snowflake to container
        snowContainer.appendChild(snowflake);
    }

    // Show the snow container
    snowContainer.classList.add('active');
}

// Fog animation effect
function createFogEffect() {
    const fogContainer = document.querySelector('.fog-container');
    fogContainer.innerHTML = '';

    // Create multiple fog layers
    for (let i = 0; i < 3; i++) {
        const fogLayer = document.createElement('div');
        fogLayer.className = 'fog-layer';

        // Different properties for each layer
        const yPos = i * 30; // Different vertical positions
        const duration = 60 + i * 20; // Different durations
        const opacity = 0.3 - (i * 0.05); // Different opacities

        // Set fog layer styles
        fogLayer.style.top = `${yPos}%`;
        fogLayer.style.opacity = opacity;
        fogLayer.style.animationDuration = `${duration}s`;

        // Add fog layer to container
        fogContainer.appendChild(fogLayer);
    }

    // Show the fog container
    fogContainer.classList.add('active');
}

// Thunder animation effect
function createThunderEffect() {
    const thunderContainer = document.querySelector('.thunder-container');
    thunderContainer.innerHTML = '';

    // Create multiple lightning flashes
    for (let i = 0; i < 3; i++) {
        const lightning = document.createElement('div');
        lightning.className = 'lightning';

        // Random delay between flashes
        const flashDelay = i * 2.5;
        lightning.style.animationDelay = `${flashDelay}s`;

        // Add lightning to container
        thunderContainer.appendChild(lightning);
    }

    // Show the thunder container
    thunderContainer.classList.add('active');
}

// Sun rays effect
function activateSunRays(intensity = 0.6) {
    const sunRays = document.querySelector('.sun-rays');
    sunRays.style.opacity = intensity;
    sunRays.classList.add('active');
} 