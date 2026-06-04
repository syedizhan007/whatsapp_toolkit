// Diagnostic script to check section structure
console.log('=== SECTION STRUCTURE DIAGNOSTIC ===');

const sections = document.querySelectorAll('.content-section');
console.log(`Total sections found: ${sections.length}`);

sections.forEach((section, index) => {
    const id = section.id;
    const isActive = section.classList.contains('active');
    const display = window.getComputedStyle(section).display;
    const childCount = section.children.length;

    console.log(`\n${index + 1}. Section: ${id}`);
    console.log(`   - Active class: ${isActive}`);
    console.log(`   - Computed display: ${display}`);
    console.log(`   - Direct children: ${childCount}`);
    console.log(`   - Parent: ${section.parentElement.id || section.parentElement.className}`);
});

// Check for nested sections
console.log('\n=== CHECKING FOR NESTED SECTIONS ===');
sections.forEach(section => {
    const nestedSections = section.querySelectorAll('.content-section');
    if (nestedSections.length > 0) {
        console.error(`ERROR: Section ${section.id} contains ${nestedSections.length} nested sections!`);
        nestedSections.forEach(nested => {
            console.error(`  - Nested: ${nested.id}`);
        });
    }
});

// Check bulk-sender specifically
console.log('\n=== BULK-SENDER SPECIFIC CHECK ===');
const bulkSender = document.getElementById('bulk-sender');
if (bulkSender) {
    console.log('Bulk-sender found');
    console.log('Display:', window.getComputedStyle(bulkSender).display);
    console.log('Active:', bulkSender.classList.contains('active'));
    console.log('Parent:', bulkSender.parentElement.id || bulkSender.parentElement.className);

    // Check if bulk-sender content is leaking
    const nextSibling = bulkSender.nextElementSibling;
    if (nextSibling) {
        console.log('Next sibling:', nextSibling.id || nextSibling.className);
    }
} else {
    console.error('ERROR: bulk-sender section not found!');
}
