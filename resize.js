window.addEventListener('resize', refreshDiv);

// some code to help stopping the canvas from stretching objects by putting the canvas in a container and resizing it dynamically - not great but it works here 
function refreshDiv() {
  const container = document.getElementById('canvas-container');
  container.style.width = '100%';
  container.style.height = '100%';

  if (window.innerWidth < 800 || window.innerHeight < 600) {
    container.style.width = '100vw';
    container.style.height = 'auto';
  } else if (window.innerWidth < 1200 || window.innerHeight < 900) {
    container.style.width = '100vw';
    container.style.height = 'auto';
  } else if (window.innerWidth < 1400 || window.innerHeight < 1000) {
    container.style.width = '100vw';
    container.style.height = 'auto';
  } else if (window.innerWidth < 1600 || window.innerHeight < 1200) {
    container.style.width = '100vw';
    container.style.height = 'auto';
  } else if (window.innerWidth < 1800 || window.innerHeight < 1300) {
    container.style.width = '100vw';
    container.style.height = 'auto';
  } else if (window.innerWidth < 2000 || window.innerHeight < 1400) {
    container.style.width = '100vw';
    container.style.height = 'auto';
  } else {
    container.style.width = '100vw';
    container.style.height = '100vh';
  }
}

refreshDiv();
