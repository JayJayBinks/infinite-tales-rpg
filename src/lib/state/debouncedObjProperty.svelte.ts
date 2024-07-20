//TODO can this be used to auto debounce a property setter? or too much?
// <script>
// import { onMount } from 'svelte';
//
// let obj = {};
// let ref = 'example';
// let valueToSet = 123;
// let timeout;
//
// // Debounce function
// function debounce(func, delay) {
//     return function(...args) {
//         clearTimeout(timeout);
//         timeout = setTimeout(() => {
//             func(...args);
//         }, delay);
//     };
// }
//
// // Setter function
// function setDebouncedValue(value) {
//     console.log(`Setting value to: ${value}`);
//     obj._value = value;
//     // Manually trigger Svelte reactivity if needed
//     $$invalidate('obj', obj);
// }
//
// // Debounced setter
// const debouncedSetter = debounce(setDebouncedValue, 300);
//
// // Define the property with getter and setter
// Object.defineProperty(obj, ref, {
//     set(value) {
//         debouncedSetter(value);
//     },
//     get() {
//         console.log('Getting value');
//         return this._value;
//     },
//     enumerable: true,
//     configurable: true
// });
//
// // Function to set the value
// function setValue() {
//     obj[ref] = valueToSet;
// }
//
// // Ensure reactivity on mount
// onMount(() => {
//     $$invalidate('obj', obj);
// });
// </script>
//
// <button on:click={setValue}>Set Value</button>
// <p>Value: {obj[ref]}</p>