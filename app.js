const $ = (selector) => document.querySelector(selector);
const toast = (message) => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => el.classList.remove('show'), 2600); };
const NAVER_CLIENT_ID = 'jfs5ldpnqa';
const DEFAULT_COORDS = { latitude: 37.5665, longitude: 126.9780 };

let selectedPlace = '시청역 2번 출구 화장실';
let currentCoords = null;
let naverMap = null;
let naverMarkers = [];

function selectPlace(name, item) { document.querySelectorAll('.restroom-item').forEach((x) => x.classList.remove('selected')); item?.classList.add('selected'); selectedPlace = name; toast(`${selectedPlace}을(를) 선택했어요.`); }
function bindRestroomInteractions() { document.querySelectorAll('.restroom-item').forEach((item) => item.addEventListener('click', () => selectPlace(item.dataset.place, item))); document.querySelectorAll('.toilet-pin').forEach((pin) => pin.addEventListener('click', () => { selectedPlace = pin.dataset.name; toast(`${selectedPlace} · 길 안내 준비 완료`); })); }
bindRestroomInteractions();

$('#routeButton').addEventListener('click', openNaverRestroomSearch);
function openNaverRestroomSearch(){ window.open('https://map.naver.com/p/search/%ED%99%94%EC%9E%A5%EC%8B%A4', '_blank', 'noopener,noreferrer'); toast('네이버 지도에서 주변 화장실 검색을 열었어요.'); }
$('#refreshButton').addEventListener('click', openNaverRestroomSearch);
$('#mapLaunchButton')?.addEventListener('click', openNaverRestroomSearch);
document.querySelectorAll('.text-button').forEach((button) => button.addEventListener('click', () => toast(button.dataset.toast)));

let breathing = false;
$('#breathButton').addEventListener('click', () => { breathing = !breathing; $('#breathOrb').classList.toggle('active', breathing); $('#breathButton').textContent = breathing ? '호흡 멈추기' : '호흡 시작'; $('#breathStatus').textContent = breathing ? '4초 들이마시고 6초 내쉬기' : '준비됨'; });
let audioContext;
let musicPlaying = false;
$('#musicButton').addEventListener('click', () => { musicPlaying = !musicPlaying; $('#musicButton').textContent = musicPlaying ? 'Ⅱ' : '▶'; toast(musicPlaying ? 'YouTube 릴랙스 음악을 재생 중이에요.' : '릴랙스 음악을 멈췄어요.'); if (musicPlaying) startYoutubeMusic(); else stopYoutubeMusic(); });
function startTone(){ try { audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)(); const osc = audioContext.createOscillator(); const gain = audioContext.createGain(); osc.frequency.value = 220; gain.gain.value = .025; osc.connect(gain).connect(audioContext.destination); osc.start(); window.relaxOscillator = osc; } catch(e) { toast('브라우저에서 오디오 재생을 허용해 주세요.'); } }
function stopTone(){ if(window.relaxOscillator){ window.relaxOscillator.stop(); window.relaxOscillator = null; } }
function startYoutubeMusic(){ const embed = $('#musicEmbed'); if(embed) embed.innerHTML = '<iframe src="https://www.youtube.com/embed/KYC99Ev2sz4?autoplay=1&rel=0" title="차분한 호흡과 릴랙스 음악" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>'; }
function stopYoutubeMusic(){ const embed = $('#musicEmbed'); if(embed) embed.innerHTML = ''; }

function locateAndSearch(){ $('#statusText').textContent = '현재 위치 확인 중'; if (!navigator.geolocation) return fakeLocate(); navigator.geolocation.getCurrentPosition((position) => { currentCoords = position.coords; $('#statusText').textContent = '현재 위치 확인 완료'; $('#locationHint').textContent = `위치 확인 완료 · ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`; loadNaverMap(position.coords); searchNearbyRestrooms(position.coords); }, () => fakeLocate(), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }); }
function fakeLocate(){ $('#statusText').textContent = '위치 권한이 필요해요'; $('#locationHint').textContent = '브라우저 위치 권한을 허용하면 실제 주변 화장실을 검색합니다.'; toast('위치 권한을 허용해 주세요.'); }

async function searchNearbyRestrooms(coords, refreshing = false) {
  const radius = 1500; $('#statusText').textContent = refreshing ? '주변 화장실 새로 고치는 중' : '주변 화장실 검색 중';
  const query = `[out:json][timeout:12];(nwr["amenity"="toilets"](around:${radius},${coords.latitude},${coords.longitude});nwr["toilets"="yes"](around:${radius},${coords.latitude},${coords.longitude}););out center tags;`;
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}` });
    if (!response.ok) throw new Error('search failed');
    const data = await response.json(); const places = data.elements.map((element) => normalizePlace(element, coords)).filter(Boolean).sort((a, b) => a.distance - b.distance).slice(0, 12);
    renderRestrooms(places); drawNaverMarkers(places); $('#statusText').textContent = `${places.length}곳의 주변 화장실을 찾았어요`; toast(places.length ? `${places.length}곳의 실제 주변 화장실을 찾았어요.` : '반경 1.5km 안에 등록된 화장실이 없어요.');
  } catch (error) { $('#statusText').textContent = '검색 연결 실패'; toast('화장실 데이터 연결에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
}
function normalizePlace(element, origin) { const lat = element.lat ?? element.center?.lat; const lon = element.lon ?? element.center?.lon; if (typeof lat !== 'number' || typeof lon !== 'number') return null; const tags = element.tags || {}; const name = tags.name || tags['name:ko'] || (tags.operator ? `${tags.operator} 화장실` : '공중화장실'); const distance = Math.round(distanceInMeters(origin.latitude, origin.longitude, lat, lon)); return { id: `${element.type}-${element.id}`, name, lat, lon, distance, tags, osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}` }; }
function distanceInMeters(lat1, lon1, lat2, lon2) { const toRad = (value) => value * Math.PI / 180; const earth = 6371000; const dLat = toRad(lat2-lat1); const dLon = toRad(lon2-lon1); const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2; return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); }
function distanceText(distance) { return distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`; }
function featureText(tags) { const values = []; if (tags.opening_hours) values.push(tags.opening_hours); if (tags.wheelchair === 'yes') values.push('장애인 편의'); if (tags.fee === 'no') values.push('무료'); return values.join(' · ') || '시설 상세정보 확인 필요'; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }

function renderRestrooms(places) { const list = $('.restroom-list'); $('#resultCount').textContent = `${places.length}곳`; list.querySelectorAll('.restroom-item, .empty-result').forEach((node) => node.remove()); const routeButton = $('#routeButton'); places.forEach((place, index) => { const item = document.createElement('article'); item.className = `restroom-item${index === 0 ? ' selected' : ''}`; item.dataset.place = place.name; item.innerHTML = `<div class="place-icon">🚻</div><div class="place-info"><strong>${escapeHtml(place.name)}</strong><span>현재 위치에서 ${distanceText(place.distance)}</span><small>${escapeHtml(featureText(place.tags))}</small></div>${index === 0 ? '<b>가장 가까움</b>' : ''}`; item.addEventListener('click', () => selectPlace(place.name, item)); list.insertBefore(item, routeButton); if (index === 0) selectedPlace = place.name; }); if (!places.length) { const empty = document.createElement('div'); empty.className = 'empty-result'; empty.textContent = '주변에 등록된 화장실이 없습니다.'; list.insertBefore(empty, routeButton); selectedPlace = ''; } }

function loadNaverMap(coords){ if(window.naver && window.naver.maps) return renderNaverMap(coords); const clientId = new URLSearchParams(location.search).get('naverClientId') || NAVER_CLIENT_ID; if(!clientId) return; const script = document.createElement('script'); script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(clientId)}`; script.onload = () => renderNaverMap(coords); script.onerror = () => toast('네이버 지도 SDK를 불러오지 못했어요. Client ID의 웹 서비스 URL 등록을 확인해 주세요.'); document.head.appendChild(script); }
function renderNaverMap(coords){ if(!window.naver || !window.naver.maps) return; const center = new naver.maps.LatLng(coords.latitude, coords.longitude); $('#mapFallback').style.display='none'; $('#naverMap').style.display='block'; if(naverMap){ naverMap.setCenter(center); return; } naverMap = new naver.maps.Map('naverMap', { center, zoom: 16 }); new naver.maps.Marker({ position: center, map: naverMap }); if (window.pendingPlaces) drawNaverMarkers(window.pendingPlaces); }
function drawNaverMarkers(places){ window.pendingPlaces = places; if(!naverMap) return; naverMarkers.forEach((marker) => marker.setMap(null)); naverMarkers = []; places.forEach((place) => { const marker = new naver.maps.Marker({ position: new naver.maps.LatLng(place.lat, place.lon), map: naverMap, title: place.name }); naver.maps.Event.addListener(marker, 'click', () => toast(place.name)); naverMarkers.push(marker); }); }
