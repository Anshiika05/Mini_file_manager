const fileForm = document.querySelector('.fileform');
const filenameInput = document.querySelector('#filename');
const contentInput = document.querySelector('#content');
const message = document.querySelector('.message');
const dataSection = document.querySelector('.info_storage');

const showFile = ({ filename, content }) => {
  dataSection.replaceChildren();

  const heading = document.createElement('h3');
  heading.textContent = filename;
  const fileContent = document.createElement('pre');
  fileContent.textContent = content;

  dataSection.append(heading, fileContent);
};

fileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';

  try {
    const response = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: filenameInput.value.trim(),
        content: contentInput.value,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save the file.');

    showFile(result.file);
    message.textContent = result.message;
    filenameInput.value = '';
    contentInput.value = '';
  } catch (error) {
    message.textContent = error.message;
  }
});

fileForm.addEventListener('reset', () => {
  dataSection.replaceChildren();
  message.textContent = '';
});
