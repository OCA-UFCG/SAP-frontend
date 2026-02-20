export const GET_SOBRE_NOS_HOMEPAGE = `
  query GetSobreNosHomePage {
    aboutCollection(limit: 1) {
      items {
        sys {
          id
        }
        title
        text {
          json
        }
        image {
          url
          title
          width
          height
        }
      }
    }
  }
`;